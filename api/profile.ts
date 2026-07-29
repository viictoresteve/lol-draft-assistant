import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/profile?gameName=Faker&tagLine=KR1&region=kr
 *
 * Rich player profile from real ranked data (heavier than /api/summoner):
 *   1. Account-V1  (cluster): Riot ID → puuid
 *   2. League-V4   (platform): solo/flex rank
 *   3. Match-V5    (cluster): last N ranked games → role split + per-champ W/L
 *
 * Powers the profile card and the personalised-AI features. Key stays
 * server-side via RIOT_API_KEY (501 when unconfigured).
 */

const PLATFORM_CLUSTER: Record<string, string> = {
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe',
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas', oc1: 'americas',
  kr: 'asia', jp1: 'asia',
};

const POSITION_ROLE: Record<string, string> = {
  TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'adc', UTILITY: 'support',
};

interface MatchParticipant {
  puuid: string;
  championId: number;
  championName: string;
  teamPosition: string;
  win: boolean;
}
interface LeagueEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const gameName = String(req.query['gameName'] ?? '').trim();
  const tagLine = String(req.query['tagLine'] ?? '').trim().replace(/^#/, '');
  const region = String(req.query['region'] ?? 'euw1').toLowerCase();
  const count = Math.min(20, Math.max(1, Math.round(Number(req.query['count'] ?? 12)) || 12));

  if (!gameName || !tagLine) { res.status(400).json({ error: 'Missing Riot ID — expected gameName#tagLine' }); return; }
  const cluster = PLATFORM_CLUSTER[region];
  if (!cluster) { res.status(400).json({ error: `Unknown region "${region}"` }); return; }

  const key = process.env['RIOT_API_KEY'];
  if (!key) { res.status(501).json({ error: 'Riot lookup not configured on the server', code: 'NO_KEY' }); return; }

  const headers = { 'X-Riot-Token': key };

  try {
    // 1) Riot ID → puuid
    const acctRes = await fetch(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers },
    );
    if (acctRes.status === 404) { res.status(404).json({ error: 'Riot ID not found', code: 'NOT_FOUND' }); return; }
    if (acctRes.status === 401 || acctRes.status === 403) { res.status(502).json({ error: 'Riot API key invalid or expired', code: 'BAD_KEY' }); return; }
    if (acctRes.status === 429) { res.status(429).json({ error: 'Rate limited by Riot — try again shortly', code: 'RATE' }); return; }
    if (!acctRes.ok) { res.status(502).json({ error: `Riot account lookup failed (${acctRes.status})` }); return; }
    const acct = (await acctRes.json()) as { puuid: string; gameName: string; tagLine: string };

    // 2) rank (League-V4 by puuid) — best-effort, unranked players just have none
    const rank = await fetchRank(region, acct.puuid, headers);

    // 3) recent ranked matches → role split + per-champ W/L
    const idsRes = await fetch(
      `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${acct.puuid}/ids?type=ranked&start=0&count=${count}`,
      { headers },
    );
    const matchIds: string[] = idsRes.ok ? await idsRes.json() : [];

    const roleGames = new Map<string, number>();
    const champStats = new Map<string, { championId: number; games: number; wins: number }>();

    const details = await Promise.allSettled(
      matchIds.map((id) =>
        fetch(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${id}`, { headers }).then((r) =>
          r.ok ? (r.json() as Promise<{ info: { participants: MatchParticipant[] } }>) : null,
        ),
      ),
    );

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

    const roles = [...roleGames.entries()]
      .map(([role, games]) => ({ role, games }))
      .sort((a, b) => b.games - a.games);

    const champions = [...champStats.entries()]
      .map(([championName, s]) => ({
        championId: s.championId,
        championName,
        games: s.games,
        wins: s.wins,
        winRate: s.games ? Math.round((s.wins / s.games) * 100) : 0,
      }))
      .sort((a, b) => b.games - a.games);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    res.status(200).json({
      gameName: acct.gameName,
      tagLine: acct.tagLine,
      region,
      rank,
      roles,
      champions,
      sampleSize: analyzed,
    });
  } catch {
    res.status(502).json({ error: 'Could not reach the Riot API' });
  }
}

/** Solo-queue rank (falls back to flex), or null when unranked / on error. */
async function fetchRank(
  region: string,
  puuid: string,
  headers: Record<string, string>,
): Promise<{ queue: string; tier: string; division: string; lp: number; wins: number; losses: number } | null> {
  try {
    const r = await fetch(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
      { headers },
    );
    if (!r.ok) return null;
    const entries = (await r.json()) as LeagueEntry[];
    const solo = entries.find((e) => e.queueType === 'RANKED_SOLO_5x5');
    const flex = entries.find((e) => e.queueType === 'RANKED_FLEX_SR');
    const e = solo ?? flex;
    if (!e) return null;
    return {
      queue: e.queueType === 'RANKED_SOLO_5x5' ? 'Solo/Duo' : 'Flex',
      tier: e.tier,
      division: e.rank,
      lp: e.leaguePoints,
      wins: e.wins,
      losses: e.losses,
    };
  } catch {
    return null;
  }
}
