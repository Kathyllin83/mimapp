import { isAllowed, parseRobots, crawlDelaySeconds, type RobotsRules } from "./robots";
import {
  MAX_BODY_BYTES,
  MIN_HOST_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
  userAgent as defaultUserAgent,
} from "./config";

export type FetchOutcome =
  | { kind: "ok"; status: number; body: string; url: string }
  | { kind: "blocked"; reason: string }
  | { kind: "robots-denied"; reason: string }
  | { kind: "error"; reason: string };

export interface PoliteClientOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
  minIntervalMs?: number;
}

const CAPTCHA =
  /captcha|are you a robot|verifica[cç][aã]o de seguran[cç]a|access denied|cf-chl|px-captcha/i;

/** Cliente HTTP que respeita robots.txt, 5 s por host, sem paralelismo por host e sem disfarce. */
export class PoliteClient {
  private fetchImpl: typeof fetch;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private ua: string;
  private minInterval: number;
  private lastRequest = new Map<string, number>();
  private robots = new Map<string, RobotsRules | "unreadable">();
  private queue = new Map<string, Promise<unknown>>();

  constructor(opts: PoliteClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.ua = opts.userAgent ?? defaultUserAgent();
    this.minInterval = Math.max(opts.minIntervalMs ?? MIN_HOST_INTERVAL_MS, MIN_HOST_INTERVAL_MS);
  }

  get userAgent() {
    return this.ua;
  }

  /** Serializa requisições por host. */
  private serial<T>(host: string, task: () => Promise<T>): Promise<T> {
    const prev = this.queue.get(host) ?? Promise.resolve();
    const next = prev.then(task, task);
    this.queue.set(host, next);
    return next;
  }

  private async throttle(host: string, extraDelaySeconds: number | null) {
    const wait = Math.max(this.minInterval, (extraDelaySeconds ?? 0) * 1000);
    const last = this.lastRequest.get(host);
    if (last !== undefined) {
      const remaining = last + wait - this.now();
      if (remaining > 0) await this.sleep(remaining);
    }
    this.lastRequest.set(host, this.now());
  }

  private async rawGet(url: URL, delay: number | null): Promise<Response> {
    await this.throttle(url.host, delay);
    return this.fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "user-agent": this.ua, accept: "text/html,application/xml,text/plain;q=0.9" },
    });
  }

  private async loadRobots(url: URL): Promise<RobotsRules | "unreadable"> {
    const cached = this.robots.get(url.origin);
    if (cached) return cached;
    let result: RobotsRules | "unreadable";
    try {
      const res = await this.rawGet(new URL("/robots.txt", url.origin), null);
      if (res.status === 404) result = { groups: [] };
      else if (res.ok) result = parseRobots(await res.text());
      else result = "unreadable";
    } catch {
      result = "unreadable";
    }
    this.robots.set(url.origin, result);
    return result;
  }

  get(input: string): Promise<FetchOutcome> {
    const url = new URL(input);
    return this.serial(url.host, async () => {
      const rules = await this.loadRobots(url);
      if (rules === "unreadable") {
        return { kind: "robots-denied", reason: "robots.txt ilegível; coleta negada" } as const;
      }
      if (!isAllowed(rules, this.ua, url.pathname + url.search)) {
        return { kind: "robots-denied", reason: `robots.txt proíbe ${url.pathname}` } as const;
      }
      try {
        const res = await this.rawGet(url, crawlDelaySeconds(rules, this.ua));
        if ([401, 403, 429].includes(res.status)) {
          return { kind: "blocked", reason: `HTTP ${res.status}` } as const;
        }
        if (!res.ok) return { kind: "error", reason: `HTTP ${res.status}` } as const;
        const body = (await res.text()).slice(0, MAX_BODY_BYTES);
        if (CAPTCHA.test(body.slice(0, 20_000)) && !body.includes("__NEXT_DATA__")) {
          return { kind: "blocked", reason: "verificação anti-bot detectada" } as const;
        }
        return { kind: "ok", status: res.status, body, url: res.url || url.href } as const;
      } catch (e) {
        return { kind: "error", reason: e instanceof Error ? e.message : "falha de rede" } as const;
      }
    });
  }
}
