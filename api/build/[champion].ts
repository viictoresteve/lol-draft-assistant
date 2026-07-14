import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callMcp, parseBuildText, fromCache, toCache } from '../_opgg';

/**
 * GET /api/build/:champion?position=mid — real OP.GG build for a champion:
 * core items, boots, starter, runes, skill order, summoner spells and combos.
 * First-hand data (not AI), from the same champion-analysis call as counters.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawName = String(req.query['champion'] ?? '');
  const champion = rawName.toUpperCase().replace(/\s+/g, '_');
  const position = String(req.query['position'] ?? 'mid').toUpperCase();

  if (!champion) { res.status(400).json({ error: 'Missing champion' }); return; }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  const cacheKey = `build:${champion}:${position}`;
  const cached = fromCache(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const { ok, status, text } = await callMcp('lol_get_champion_analysis', {
      champion, position, game_mode: 'ranked', lang: 'en_US',
    });
    if (!ok || !text) { res.status(503).json({ error: `OP.GG returned ${status}` }); return; }

    const build = parseBuildText(text);
    const data = { champion: rawName, position, ...build };
    toCache(cacheKey, data);
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Could not fetch build data' });
  }
}
