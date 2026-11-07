import { describe, expect, it } from "vitest";
import { crawlDelaySeconds, isAllowed, parseRobots } from "./robots";
import { PoliteClient } from "./http";

const UA = "MimaBot/1.0 (+x)";

describe("robots.txt", () => {
  it("aplica Disallow e Allow mais específico", () => {
    const r = parseRobots("User-agent: *\nDisallow: /api/\nDisallow: /buscar\nAllow: /api/publico");
    expect(isAllowed(r, UA, "/api/x")).toBe(false);
    expect(isAllowed(r, UA, "/api/publico/1")).toBe(true);
    expect(isAllowed(r, UA, "/buscar?q=a")).toBe(false);
    expect(isAllowed(r, UA, "/promocoes/")).toBe(true);
  });
  it("suporta wildcard e $", () => {
    const r = parseRobots("User-agent: *\nDisallow: /*.pdf$\nDisallow: /a/*/b");
    expect(isAllowed(r, UA, "/x/y.pdf")).toBe(false);
    expect(isAllowed(r, UA, "/x/y.pdf?z=1")).toBe(true);
    expect(isAllowed(r, UA, "/a/1/b")).toBe(false);
  });
  it("escolhe o grupo do agente e cai em *", () => {
    const r = parseRobots(
      "User-agent: *\nDisallow: /\n\nUser-agent: MimaBot\nDisallow: /privado\nCrawl-delay: 10",
    );
    expect(isAllowed(r, UA, "/publico")).toBe(true);
    expect(isAllowed(r, UA, "/privado")).toBe(false);
    expect(isAllowed(r, "OutroBot/1", "/publico")).toBe(false);
    expect(crawlDelaySeconds(r, UA)).toBe(10);
  });
  it("Disallow vazio libera tudo", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), UA, "/qualquer")).toBe(true);
  });
});

function mkClient(responses: Record<string, Response | (() => Response)>) {
  const calls: string[] = [];
  const times: number[] = [];
  let clock = 0;
  const fetchImpl = (async (u: URL) => {
    const key = u.pathname + u.search;
    calls.push(key);
    times.push(clock);
    const r = responses[key];
    if (!r) return new Response("", { status: 404 });
    return typeof r === "function" ? r() : r.clone();
  }) as unknown as typeof fetch;
  const client = new PoliteClient({
    fetchImpl,
    userAgent: UA,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  return { client, calls, times };
}

describe("PoliteClient", () => {
  it("falha na leitura do robots.txt nega a coleta", async () => {
    const { client, calls } = mkClient({ "/robots.txt": new Response("", { status: 500 }) });
    const out = await client.get("https://a.test/p");
    expect(out.kind).toBe("robots-denied");
    expect(calls).toEqual(["/robots.txt"]);
  });
  it("robots 404 libera; respeita Disallow", async () => {
    const { client } = mkClient({ "/p": new Response("ok") });
    expect((await client.get("https://a.test/p")).kind).toBe("ok");
    const b = mkClient({
      "/robots.txt": new Response("User-agent: *\nDisallow: /p"),
      "/p": new Response("x"),
    });
    const out = await b.client.get("https://a.test/p");
    expect(out.kind).toBe("robots-denied");
    expect(b.calls).not.toContain("/p");
  });
  it.each([401, 403, 429])("HTTP %i marca bloqueada", async (status) => {
    const { client } = mkClient({ "/p": new Response("no", { status }) });
    expect((await client.get("https://a.test/p")).kind).toBe("blocked");
  });
  it("detecta CAPTCHA", async () => {
    const { client } = mkClient({ "/p": new Response("<html>Please solve the CAPTCHA</html>") });
    expect((await client.get("https://a.test/p")).kind).toBe("blocked");
  });
  it("espera 5 s entre requisições ao mesmo host", async () => {
    const { client, times } = mkClient({ "/1": new Response("a"), "/2": new Response("b") });
    await client.get("https://a.test/1");
    await client.get("https://a.test/2");
    for (let i = 1; i < times.length; i++)
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(5000);
  });
});
