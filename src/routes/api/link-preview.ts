import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createFileRoute } from "@tanstack/react-router";
import { getUser, json } from "@/lib/server/auth";

const MAX_BYTES = 750_000;
const MAX_REDIRECTS = 4;

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  if (!/^https?:$/.test(url.protocol)) throw new Error("Protocolo inválido");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some((a) => isPrivateIp(a.address))) throw new Error("Endereço não permitido");
}

async function fetchHtml(start: URL): Promise<{ html: string; finalUrl: URL }> {
  let url = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; MimaBot/1.0; +link-preview)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    void reader.cancel().catch(() => {});
    return { html: Buffer.concat(chunks).toString("utf8"), finalUrl: url };
  }
  throw new Error("Redirecionamentos demais");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function meta(html: string, keys: string[]): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!key || !keys.includes(key)) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) return decode(value);
  }
  return undefined;
}

function jsonLdImage(html: string): string | undefined {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const stack: unknown[] = [JSON.parse(m[1] ?? "")];
      while (stack.length) {
        const node = stack.pop();
        if (Array.isArray(node)) stack.push(...node);
        else if (node && typeof node === "object") {
          const o = node as Record<string, unknown>;
          const img = Array.isArray(o["image"]) ? o["image"][0] : o["image"];
          const src = typeof img === "string" ? img : (img as { url?: string } | undefined)?.url;
          if (o["@type"] === "Product" && src) return src;
          stack.push(...Object.values(o));
        }
      }
    } catch {
      /* JSON-LD inválido: ignora */
    }
  }
  return undefined;
}

export const Route = createFileRoute("/api/link-preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return json({ error: "Não autenticado" }, { status: 401 });
        const raw = new URL(request.url).searchParams.get("url");
        let target: URL;
        try {
          target = new URL(raw ?? "");
        } catch {
          return json({ error: "Link inválido" }, { status: 400 });
        }
        try {
          const { html, finalUrl } = await fetchHtml(target);
          const imageRaw =
            meta(html, ["og:image", "og:image:secure_url", "twitter:image"]) ?? jsonLdImage(html);
          let image: string | undefined;
          if (imageRaw) {
            const abs = new URL(imageRaw, finalUrl);
            if (/^https?:$/.test(abs.protocol)) image = abs.toString();
          }
          const title =
            meta(html, ["og:title", "twitter:title"]) ??
            decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
          return json({ image, title: title || undefined });
        } catch {
          // Muitos sites bloqueiam bots: o app segue sem imagem.
          return json({ image: undefined, title: undefined });
        }
      },
    },
  },
});
