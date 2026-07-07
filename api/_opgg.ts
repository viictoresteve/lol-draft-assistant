/**
 * Shared OP.GG MCP (Model Context Protocol) client for the Vercel serverless
 * functions. Ported from the standalone Express proxy (server/src/index.ts) so
 * the live, patch-current tier + matchup data works on the same Vercel domain
 * with zero CORS and no separate host to deploy.
 *
 * Files prefixed with "_" are NOT exposed as routes by Vercel.
 */

const OPGG_MCP_URL = 'https://mcp-api.op.gg/mcp';

export const VALID_ROLES = new Set(['top', 'jungle', 'mid', 'adc', 'support']);

// Response class names per role in the MCP text format
const ROLE_CLASS: Record<string, string> = {
  top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Adc', support: 'Support',
};

// OP.GG tier scale: 1=OP/S, 2=Strong/A, 3=Good/B, 4=Average/C, 5=Weak/D
const TIER_LABEL: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' };

// ── Tiny in-memory cache (survives warm invocations of the same function) ──
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export function fromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data;
}
export function toCache(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

/** Call an OP.GG MCP tool and return the raw text payload (or '' on miss). */
export async function callMcp(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; status: number; text: string }> {
  const upstream = await fetch(OPGG_MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  if (!upstream.ok) return { ok: false, status: upstream.status, text: '' };
  const json = (await upstream.json()) as { result?: { content?: { text?: string }[] } };
  return { ok: true, status: 200, text: json?.result?.content?.[0]?.text ?? '' };
}

// ── Parsers ────────────────────────────────────────────────────────────────

/**
 * Parse the lane-meta text, e.g.:
 *   Adc("Jinx",false,156235,80703,1167312,0.52,0.12,1,0.02,2.23,1,1,1,3)
 * Fields: champion,is_rip,play,win,kill,win_rate,pick_rate,role_rate,ban_rate,kda,tier,...
 */
export function parseTierText(text: string, role: string): { name: string; tier: string; win_rate: number; pick_rate: number }[] {
  const className = ROLE_CLASS[role] ?? role;
  const re = new RegExp(
    `${className}\\("([^"]+)",(?:true|false),\\d+,\\d+,\\d+,` +
    `([\\d.]+),([\\d.]+),[\\d.]+,([\\d.]+),[\\d.]+,(\\d+)`,
    'g',
  );
  const results: { name: string; tier: string; win_rate: number; pick_rate: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    results.push({
      name: m[1],
      win_rate: parseFloat(m[2]),
      pick_rate: parseFloat(m[3]),
      tier: TIER_LABEL[parseInt(m[5])] ?? '',
    });
  }
  return results;
}

/** Parse champion-analysis text into damage type + top counters. */
export function parseCounterText(text: string): { damageType: string; counters: { name: string; winRate: number; games: number }[] } {
  const dmgMatch = text.match(/"(AP|AD|MIXED|TRUE)"/);
  const damageType = dmgMatch?.[1] ?? 'MIXED';

  const counterRe = /StrongCounter\(\d+,"([^"]+)",(\d+),(\d+),([\d.]+)\)/g;
  const counters: { name: string; winRate: number; games: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = counterRe.exec(text)) !== null) {
    const [, name, games, , wr] = m;
    counters.push({ name, winRate: Math.round(parseFloat(wr) * 100), games: parseInt(games) });
  }

  const seen = new Set<string>();
  const topCounters = counters
    .sort((a, b) => b.winRate - a.winRate)
    .filter((c) => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
    .slice(0, 8);

  return { damageType, counters: topCounters };
}
