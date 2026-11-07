/** Parser de robots.txt: grupos por agente, Allow/Disallow com * e $, regra mais específica vence. */
interface Rule {
  allow: boolean;
  pattern: string;
}
interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay: number | null;
}
export interface RobotsRules {
  groups: Group[];
}

export function parseRobots(text: string): RobotsRules {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // Disallow vazio = nada proibido; ignorado.
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups };
}

function pickGroup(rules: RobotsRules, agent: string): Group | null {
  const name = agent.toLowerCase().split(/[\s/]/)[0] ?? "";
  let best: Group | null = null;
  let bestLen = -1;
  for (const g of rules.groups) {
    for (const a of g.agents) {
      if (a === "*") {
        if (bestLen < 0) {
          best = g;
          bestLen = 0;
        }
      } else if (name.includes(a) && a.length > bestLen) {
        best = g;
        bestLen = a.length;
      }
    }
  }
  return best;
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${re}${anchored ? "$" : ""}`).test(path);
}

/** `path` deve incluir a query string (ex.: "/buscar?q=x"). */
export function isAllowed(rules: RobotsRules, agent: string, path: string): boolean {
  const group = pickGroup(rules, agent);
  if (!group) return true;
  let verdict = true;
  let bestLen = -1;
  for (const r of group.rules) {
    if (!matches(r.pattern, path)) continue;
    const len = r.pattern.length;
    if (len > bestLen || (len === bestLen && r.allow)) {
      bestLen = len;
      verdict = r.allow;
    }
  }
  return verdict;
}

export function crawlDelaySeconds(rules: RobotsRules, agent: string): number | null {
  return pickGroup(rules, agent)?.crawlDelay ?? null;
}
