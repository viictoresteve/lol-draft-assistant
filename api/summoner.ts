import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/summoner?gameName=Faker&tagLine=KR1&region=kr
 *
 * Looks up a player's most-played champions (by mastery points) so the app can
 * auto-fill their champion pool. Two Riot API calls:
 *   1. Account-V1  (regional cluster): Riot ID → puuid
 *   2. Champion-Mastery-V4 (platform): puuid → top champions
 *
 * The Riot API key is read from RIOT_API_KEY and only ever lives here on the
 * server — the browser can't call Riot directly (key secrecy + CORS), which is
 * exactly why this proxy exists. When the key isn't configured the endpoint
 * returns 501 so the UI can show a friendly "not configured" message.
 */

// Platform host → regional routing cluster for Account-V1.
const PLATFORM_CLUSTER: Record<string, string> = {
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe',
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas', oc1: 'americas',
  kr: 'asia', jp1: 'asia',
};

interface RiotAccount { puuid: string; gameName: string; tagLine: string }
interface RiotMastery { championId: number; championLevel: number; championPoints: number }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const gameName = String(req.query['gameName'] ?? '').trim();
  const tagLine = String(req.query['tagLine'] ?? '').trim().replace(/^#/, '');
  const region = String(req.query['region'] ?? 'euw1').toLowerCase();
  const count = Math.min(30, Math.max(1, Math.round(Number(req.query['count'] ?? 20)) || 20));

  if (!gameName || !tagLine) {
    res.status(400).json({ error: 'Missing Riot ID — expected gameName#tagLine' });
    return;
  }
  const cluster = PLATFORM_CLUSTER[region];
  if (!cluster) {
    res.status(400).json({ error: `Unknown region "${region}"` });
    return;
  }

  const key = process.env['RIOT_API_KEY'];
  if (!key) {
    res.status(501).json({ error: 'Riot lookup not configured on the server', code: 'NO_KEY' });
    return;
  }

  const headers = { 'X-Riot-Token': key };

  try {
    // 1) Riot ID → puuid
    const acctUrl = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const acctRes = await fetch(acctUrl, { headers });
    if (acctRes.status === 404) { res.status(404).json({ error: 'Riot ID not found', code: 'NOT_FOUND' }); return; }
    if (acctRes.status === 401 || acctRes.status === 403) { res.status(502).json({ error: 'Riot API key invalid or expired', code: 'BAD_KEY' }); return; }
    if (acctRes.status === 429) { res.status(429).json({ error: 'Rate limited by Riot — try again shortly', code: 'RATE' }); return; }
    if (!acctRes.ok) { res.status(502).json({ error: `Riot account lookup failed (${acctRes.status})` }); return; }
    const acct = (await acctRes.json()) as RiotAccount;

    // 2) puuid → top champion masteries
    const masUrl = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${acct.puuid}/top?count=${count}`;
    const masRes = await fetch(masUrl, { headers });
    if (masRes.status === 429) { res.status(429).json({ error: 'Rate limited by Riot — try again shortly', code: 'RATE' }); return; }
    if (!masRes.ok) { res.status(502).json({ error: `Riot mastery lookup failed (${masRes.status})` }); return; }
    const mastery = (await masRes.json()) as RiotMastery[];

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    res.status(200).json({
      gameName: acct.gameName,
      tagLine: acct.tagLine,
      region,
      top: mastery.map((m) => ({
        championId: m.championId,
        championLevel: m.championLevel,
        championPoints: m.championPoints,
      })),
    });
  } catch {
    res.status(502).json({ error: 'Could not reach the Riot API' });
  }
}
