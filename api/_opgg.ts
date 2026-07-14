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

// ── Build parser (items / runes / skills / spells / combos) ──────────────────

const SUMMONER_SPELL_NAMES: Record<number, string> = {
  1: 'Cleanse', 3: 'Exhaust', 4: 'Flash', 6: 'Ghost', 7: 'Heal',
  11: 'Smite', 12: 'Teleport', 13: 'Clarity', 14: 'Ignite', 21: 'Barrier', 32: 'Mark',
};

export interface ChampionBuild {
  coreItems: { id: number; name: string }[];
  boots: { id: number; name: string } | null;
  starterItems: { id: number; name: string }[];
  summonerSpells: { id: number; name: string }[];
  runes: { keystone: string; primaryTree: string; secondaryTree: string; primary: string[]; secondary: string[] };
  skillOrder: string[];       // priority, e.g. ["Q","E","W"]
  skillLevels: string[];      // raw level-up sequence
  combos: { name: string; url: string }[];
  winRate: number;            // of the core build, 0–100
}

/** Match every `CoreItems([ids],[names],play,win,pick)` block in document order. */
function coreItemBlocks(text: string): { ids: number[]; names: string[]; play: number }[] {
  const re = /CoreItems\(\[([\d,]*)\],\[([^\]]*)\],(\d+),\d+,[\d.]+\)/g;
  const out: { ids: number[]; names: string[]; play: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const ids = m[1] ? m[1].split(',').map((n) => parseInt(n, 10)) : [];
    // names are quoted strings for items, bare numbers for the spells block
    const names = (m[2].match(/"([^"]*)"/g) ?? []).map((s) => s.slice(1, -1));
    out.push({ ids, names, play: parseInt(m[3], 10) });
  }
  return out;
}

/** Compute Q/W/E max priority from the raw level-up order. */
function skillPriority(order: string[]): string[] {
  const counts: Record<string, number> = { Q: 0, W: 0, E: 0 };
  const fifthAt: Record<string, number> = {};
  order.forEach((s, i) => {
    if (counts[s] !== undefined) {
      counts[s]++;
      if (counts[s] === 5 && fifthAt[s] === undefined) fifthAt[s] = i;
    }
  });
  return ['Q', 'W', 'E'].sort((a, b) => {
    const fa = fifthAt[a] ?? 99, fb = fifthAt[b] ?? 99;
    return fa !== fb ? fa - fb : counts[b] - counts[a];
  });
}

/** Parse the full build out of a champion-analysis payload. */
export function parseBuildText(text: string): ChampionBuild {
  const blocks = coreItemBlocks(text);
  const asItem = (b?: { ids: number[]; names: string[] }) =>
    b && b.ids.length ? b.ids.map((id, i) => ({ id, name: b.names[i] ?? '' })) : [];

  const coreItems = asItem(blocks[0]);
  const bootsArr = asItem(blocks[1]);
  const boots = bootsArr[0] ?? null;
  const starterItems = asItem(blocks[2]);

  // Summoner spells: the CoreItems block immediately before `Runes(` (ids only, no names).
  const runesIdx = text.indexOf('Runes(');
  let summonerSpells: { id: number; name: string }[] = [];
  const spellMatch = text.slice(0, runesIdx).match(/CoreItems\(\[([\d,]+)\],\[[\d,]+\],\d+,\d+,[\d.]+\)\s*,?\s*$/);
  const spellIds = spellMatch ? spellMatch[1].split(',').map((n) => parseInt(n, 10)) : [];
  summonerSpells = spellIds.map((id) => ({ id, name: SUMMONER_SPELL_NAMES[id] ?? '' })).filter((s) => s.name);

  // Runes: Runes(keystone,primaryPageId,"PrimaryTree",[ids],["names"],secondaryPageId,"SecondaryTree",[ids],["names"],...)
  const runes = { keystone: '', primaryTree: '', secondaryTree: '', primary: [] as string[], secondary: [] as string[] };
  const rm = text.match(/Runes\(\d+,\d+,"([^"]+)",\[[\d,]*\],\[([^\]]*)\],\d+,"([^"]+)",\[[\d,]*\],\[([^\]]*)\]/);
  if (rm) {
    runes.primaryTree = rm[1];
    runes.primary = (rm[2].match(/"([^"]*)"/g) ?? []).map((s) => s.slice(1, -1));
    runes.secondaryTree = rm[3];
    runes.secondary = (rm[4].match(/"([^"]*)"/g) ?? []).map((s) => s.slice(1, -1));
    runes.keystone = runes.primary[0] ?? '';
  }

  // Skills
  const sm = text.match(/Skills\(\[([^\]]*)\],(\d+),(\d+)/);
  const skillLevels = sm ? (sm[1].match(/"([A-Z])"/g) ?? []).map((s) => s.slice(1, -1)) : [];
  const skillOrder = skillLevels.length ? skillPriority(skillLevels) : [];
  const winRate = sm ? Math.round((parseInt(sm[3], 10) / parseInt(sm[2], 10)) * 100) : 0;

  // Combos
  const combos: { name: string; url: string }[] = [];
  const cr = /SkillCombo\("([^"]+)","([^"]+)"\)/g;
  let cm: RegExpExecArray | null;
  while ((cm = cr.exec(text)) !== null) combos.push({ name: cm[1], url: cm[2] });

  return { coreItems, boots, starterItems, summonerSpells, runes, skillOrder, skillLevels, combos: combos.slice(0, 4), winRate };
}
