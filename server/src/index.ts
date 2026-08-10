import 'dotenv/config'; // load server/.env (e.g. RIOT_API_KEY) before anything reads it
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*';
app.use(cors({ origin: allowedOrigin }));

// ── OP.GG MCP API ─────────────────────────────────────────────────────────────
// The old /api/v1.0/internal/bypass/... endpoint is dead (404).
// OP.GG now exposes an official MCP (Model Context Protocol) JSON-RPC 2.0 API.
// Source: https://github.com/opgginc/opgg-mcp
const OPGG_MCP_URL = 'https://mcp-api.op.gg/mcp';

// MCP uses "adc" as the position name (unlike the old API that used "bot")
const VALID_ROLES = new Set(['top', 'jungle', 'mid', 'adc', 'support']);

// Response class names per role (MCP text format)
const ROLE_CLASS: Record<string, string> = {
  top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Adc', support: 'Support',
};

// Tier label map (OP.GG: 1=OP/S, 2=Strong/A, 3=Good/B, 4=Average/C, 5=Weak/D)
const TIER_LABEL: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' };

const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function fromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data;
}
function toCache(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

// ── Parse OP.GG MCP text response ────────────────────────────────────────────
// MCP returns data as a typed text format, e.g.:
//   Adc("Jinx",false,156235,80703,1167312,0.52,0.12,1,0.02,2.23,1,1,1,3)
// Fields: champion,is_rip,play,win,kill,win_rate,pick_rate,role_rate,ban_rate,kda,tier,rank,...
function parseMcpText(text: string, role: string): { name: string; tier: string; win_rate: number; pick_rate: number }[] {
  const className = ROLE_CLASS[role] ?? role;

  // Capture: name, win_rate, pick_rate, ban_rate, kda, tier
  const re = new RegExp(
    `${className}\\("([^"]+)",(?:true|false),\\d+,\\d+,\\d+,` +  // name, is_rip, play, win, kill
    `([\\d.]+),([\\d.]+),[\\d.]+,([\\d.]+),[\\d.]+,(\\d+)`,      // win_rate, pick_rate, role_rate, ban_rate, kda, tier
    'g',
  );

  const results: { name: string; tier: string; win_rate: number; pick_rate: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    results.push({
      name:      m[1],
      win_rate:  parseFloat(m[2]),
      pick_rate: parseFloat(m[3]),
      tier:      TIER_LABEL[parseInt(m[5])] ?? '',
    });
  }
  return results;
}

// ── /api/tier/:role ──────────────────────────────────────────────────────────
app.get('/api/tier/:role', async (req, res) => {
  const role = req.params.role.toLowerCase();

  if (!VALID_ROLES.has(role)) {
    res.status(400).json({ error: `Unknown role: ${role}. Valid: ${[...VALID_ROLES].join(', ')}` });
    return;
  }

  const cached = fromCache(role);
  if (cached) { res.json(cached); return; }

  try {
    const upstream = await fetch(OPGG_MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'lol_list_lane_meta_champions',
          arguments: { position: role, lang: 'en_US' },
        },
      }),
    });

    if (upstream.status === 429) {
      res.status(429).json({ error: 'OP.GG MCP is rate-limiting. Try again shortly.' });
      return;
    }
    if (!upstream.ok) {
      res.status(503).json({ error: `OP.GG MCP returned ${upstream.status}` });
      return;
    }

    const json = await upstream.json() as any;
    const text: string = json?.result?.content?.[0]?.text ?? '';
    if (!text) {
      res.status(503).json({ error: 'OP.GG MCP returned empty content' });
      return;
    }

    const champions = parseMcpText(text, role);
    if (champions.length === 0) {
      res.status(503).json({ error: 'Could not parse OP.GG MCP response' });
      return;
    }

    // Return in the same shape TierListService.parse() already understands
    const data = { champion_stats: champions };
    toCache(role, data);
    res.json(data);

  } catch (err) {
    console.error('[tier] Error:', (err as Error).message);
    res.status(502).json({ error: 'Could not reach OP.GG MCP' });
  }
});

// ── Matchup data ─────────────────────────────────────────────────────────────
// GET /api/counters/:champion?position=top
// Returns what beats a specific champion + their damage type (real OP.GG data)
app.get('/api/counters/:champion', async (req, res) => {
  const champion = req.params.champion.toUpperCase().replace(/\s+/g, '_');
  const position = (req.query['position'] as string ?? 'top').toUpperCase();

  const cacheKey = `counters:${champion}:${position}`;
  const cached = fromCache(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const upstream = await fetch(OPGG_MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: {
          name: 'lol_get_champion_analysis',
          arguments: { champion, position, game_mode: 'ranked', lang: 'en_US' },
        },
      }),
    });

    if (!upstream.ok) {
      res.status(503).json({ error: `OP.GG returned ${upstream.status}` });
      return;
    }

    const json = await upstream.json() as any;
    const text: string = json?.result?.content?.[0]?.text ?? '';
    if (!text) { res.status(503).json({ error: 'Empty response' }); return; }

    // Parse damage_type: "AP" | "AD" | "MIXED"
    const dmgMatch = text.match(/"(AP|AD|MIXED|TRUE)"/);
    const damageType = dmgMatch?.[1] ?? 'MIXED';

    // Parse StrongCounter entries: StrongCounter(id,"Name",games,wins,win_rate)
    const counterRe = /StrongCounter\(\d+,"([^"]+)",(\d+),(\d+),([\d.]+)\)/g;
    const counters: { name: string; winRate: number; games: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = counterRe.exec(text)) !== null) {
      const [, name, games, , wr] = m;
      counters.push({ name, winRate: Math.round(parseFloat(wr) * 100), games: parseInt(games) });
    }

    // Sort by win rate descending, deduplicate, take top 8
    const seen = new Set<string>();
    const topCounters = counters
      .sort((a, b) => b.winRate - a.winRate)
      .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
      .slice(0, 8);

    const data = { champion: req.params.champion, position, damageType, counters: topCounters };
    toCache(cacheKey, data);
    res.json(data);

  } catch (err) {
    console.error('[counters] Error:', (err as Error).message);
    res.status(502).json({ error: 'Could not fetch matchup data' });
  }
});

// ── Riot summoner lookup (most-played champions) ────────────────────────────────
// Mirrors the Vercel /api/summoner function for local dev. Needs RIOT_API_KEY.
const PLATFORM_CLUSTER: Record<string, string> = {
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe',
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas', oc1: 'americas',
  kr: 'asia', jp1: 'asia',
};

app.get('/api/summoner', async (req, res) => {
  const gameName = String(req.query.gameName ?? '').trim();
  const tagLine = String(req.query.tagLine ?? '').trim().replace(/^#/, '');
  const region = String(req.query.region ?? 'euw1').toLowerCase();
  const count = Math.min(30, Math.max(1, Math.round(Number(req.query.count ?? 20)) || 20));

  if (!gameName || !tagLine) { res.status(400).json({ error: 'Missing Riot ID — expected gameName#tagLine' }); return; }
  const cluster = PLATFORM_CLUSTER[region];
  if (!cluster) { res.status(400).json({ error: `Unknown region "${region}"` }); return; }

  const key = process.env.RIOT_API_KEY;
  if (!key) { res.status(501).json({ error: 'Riot lookup not configured on the server', code: 'NO_KEY' }); return; }

  const headers = { 'X-Riot-Token': key };
  try {
    const acctRes = await fetch(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers },
    );
    if (acctRes.status === 404) { res.status(404).json({ error: 'Riot ID not found', code: 'NOT_FOUND' }); return; }
    if (acctRes.status === 401 || acctRes.status === 403) { res.status(502).json({ error: 'Riot API key invalid or expired', code: 'BAD_KEY' }); return; }
    if (acctRes.status === 429) { res.status(429).json({ error: 'Rate limited by Riot — try again shortly', code: 'RATE' }); return; }
    if (!acctRes.ok) { res.status(502).json({ error: `Riot account lookup failed (${acctRes.status})` }); return; }
    const acct = (await acctRes.json()) as { puuid: string; gameName: string; tagLine: string };

    const masRes = await fetch(
      `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${acct.puuid}/top?count=${count}`,
      { headers },
    );
    if (masRes.status === 429) { res.status(429).json({ error: 'Rate limited by Riot — try again shortly', code: 'RATE' }); return; }
    if (!masRes.ok) { res.status(502).json({ error: `Riot mastery lookup failed (${masRes.status})` }); return; }
    const mastery = (await masRes.json()) as { championId: number; championLevel: number; championPoints: number }[];

    res.json({
      gameName: acct.gameName, tagLine: acct.tagLine, region,
      top: mastery.map((m) => ({ championId: m.championId, championLevel: m.championLevel, championPoints: m.championPoints })),
    });
  } catch (err) {
    console.error('[summoner] Error:', (err as Error).message);
    res.status(502).json({ error: 'Could not reach the Riot API' });
  }
});

// ── Riot player profile (rank + real roles + per-champ winrate) ─────────────────
// Mirrors the Vercel /api/profile function for local dev. Needs RIOT_API_KEY.
const POSITION_ROLE: Record<string, string> = {
  TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'adc', UTILITY: 'support',
};

app.get('/api/profile', async (req, res) => {
  const gameName = String(req.query.gameName ?? '').trim();
  const tagLine = String(req.query.tagLine ?? '').trim().replace(/^#/, '');
  const region = String(req.query.region ?? 'euw1').toLowerCase();
  const count = Math.min(60, Math.max(1, Math.round(Number(req.query.count ?? 25)) || 25));

  if (!gameName || !tagLine) { res.status(400).json({ error: 'Missing Riot ID — expected gameName#tagLine' }); return; }
  const cluster = PLATFORM_CLUSTER[region];
  if (!cluster) { res.status(400).json({ error: `Unknown region "${region}"` }); return; }

  const key = process.env.RIOT_API_KEY;
  if (!key) { res.status(501).json({ error: 'Riot lookup not configured on the server', code: 'NO_KEY' }); return; }

  const headers = { 'X-Riot-Token': key };
  try {
    const acctRes = await fetch(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers },
    );
    if (acctRes.status === 404) { res.status(404).json({ error: 'Riot ID not found', code: 'NOT_FOUND' }); return; }
    if (acctRes.status === 401 || acctRes.status === 403) { res.status(502).json({ error: 'Riot API key invalid or expired', code: 'BAD_KEY' }); return; }
    if (acctRes.status === 429) { res.status(429).json({ error: 'Rate limited by Riot — try again shortly', code: 'RATE' }); return; }
    if (!acctRes.ok) { res.status(502).json({ error: `Riot account lookup failed (${acctRes.status})` }); return; }
    const acct = (await acctRes.json()) as { puuid: string; gameName: string; tagLine: string };

    // Ranks (both queues, best-effort)
    const ranks: { queue: string; tier: string; division: string; lp: number; wins: number; losses: number; winRate: number }[] = [];
    try {
      const lr = await fetch(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${acct.puuid}`, { headers });
      if (lr.ok) {
        const entries = (await lr.json()) as { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number }[];
        for (const [queueType, label] of [['RANKED_SOLO_5x5', 'Solo/Duo'], ['RANKED_FLEX_SR', 'Flex']] as const) {
          const e = entries.find((x) => x.queueType === queueType);
          if (!e) continue;
          const played = e.wins + e.losses;
          ranks.push({ queue: label, tier: e.tier, division: e.rank, lp: e.leaguePoints, wins: e.wins, losses: e.losses, winRate: played ? Math.round((e.wins / played) * 100) : 0 });
        }
      }
    } catch { /* unranked / ignore */ }

    // Recent ranked matches → role split + per-champ W/L
    const idsRes = await fetch(
      `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${acct.puuid}/ids?type=ranked&start=0&count=${count}`,
      { headers },
    );
    const matchIds: string[] = idsRes.ok ? ((await idsRes.json()) as string[]) : [];

    const roleGames = new Map<string, number>();
    const champStats = new Map<string, { championId: number; games: number; wins: number }>();
    // Batched to respect Riot's rate limit (see /api/profile).
    type Detail = { info: { participants: { puuid: string; championId: number; championName: string; teamPosition: string; win: boolean }[] } } | null;
    const CHUNK = 12;
    const details: PromiseSettledResult<Detail>[] = [];
    for (let i = 0; i < matchIds.length; i += CHUNK) {
      const batch = matchIds.slice(i, i + CHUNK).map((id) =>
        fetch(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${id}`, { headers }).then(
          (r) => (r.ok ? (r.json() as Promise<Detail>) : null),
        ),
      );
      details.push(...(await Promise.allSettled(batch)));
    }

    let analyzed = 0;
    for (const d of details) {
      if (d.status !== 'fulfilled' || !d.value) continue;
      const me = d.value.info.participants.find((p) => p.puuid === acct.puuid);
      if (!me) continue;
      analyzed++;
      const role = POSITION_ROLE[me.teamPosition] ?? '';
      if (role) roleGames.set(role, (roleGames.get(role) ?? 0) + 1);
      const cur = champStats.get(me.championName) ?? { championId: me.championId, games: 0, wins: 0 };
      cur.games++;
      if (me.win) cur.wins++;
      champStats.set(me.championName, cur);
    }

    res.json({
      gameName: acct.gameName, tagLine: acct.tagLine, region, ranks,
      roles: [...roleGames.entries()].map(([role, games]) => ({ role, games })).sort((a, b) => b.games - a.games),
      champions: [...champStats.entries()].map(([championName, s]) => ({
        championId: s.championId, championName, games: s.games, wins: s.wins,
        winRate: s.games ? Math.round((s.wins / s.games) * 100) : 0,
      })).sort((a, b) => b.games - a.games),
      sampleSize: analyzed,
    });
  } catch (err) {
    console.error('[profile] Error:', (err as Error).message);
    res.status(502).json({ error: 'Could not reach the Riot API' });
  }
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

(app as any)._cacheForTests = cache;
export { app };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[proxy] Port ${PORT}  upstream=${OPGG_MCP_URL}`);
  });
}
