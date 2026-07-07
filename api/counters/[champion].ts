import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callMcp, parseCounterText, fromCache, toCache } from '../_opgg';

/**
 * GET /api/counters/:champion?position=top — real OP.GG matchup data:
 * the champion's damage type + who beats it in lane this patch.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawName = String(req.query['champion'] ?? '');
  const champion = rawName.toUpperCase().replace(/\s+/g, '_');
  const position = String(req.query['position'] ?? 'top').toUpperCase();

  if (!champion) { res.status(400).json({ error: 'Missing champion' }); return; }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  const cacheKey = `counters:${champion}:${position}`;
  const cached = fromCache(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const { ok, status, text } = await callMcp('lol_get_champion_analysis', {
      champion, position, game_mode: 'ranked', lang: 'en_US',
    });
    if (!ok || !text) { res.status(503).json({ error: `OP.GG returned ${status}` }); return; }

    const { damageType, counters } = parseCounterText(text);
    const data = { champion: rawName, position, damageType, counters };
    toCache(cacheKey, data);
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Could not fetch matchup data' });
  }
}
