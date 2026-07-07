import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VALID_ROLES, callMcp, parseTierText, fromCache, toCache } from '../_opgg';

/**
 * GET /api/tier/:role — live OP.GG Platinum+ tier list for a lane.
 * Same-origin serverless proxy so the frontend gets patch-current data
 * without CORS or a separate host.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const role = String(req.query['role'] ?? '').toLowerCase();

  if (!VALID_ROLES.has(role)) {
    res.status(400).json({ error: `Unknown role: ${role}` });
    return;
  }

  // Cache at the edge for 10 min, allow stale-while-revalidate for another hour
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  const cached = fromCache(role);
  if (cached) { res.json(cached); return; }

  try {
    const { ok, status, text } = await callMcp('lol_list_lane_meta_champions', { position: role, lang: 'en_US' });
    if (!ok) { res.status(status === 429 ? 429 : 503).json({ error: `OP.GG MCP returned ${status}` }); return; }

    const champions = parseTierText(text, role);
    if (champions.length === 0) { res.status(503).json({ error: 'Could not parse OP.GG response' }); return; }

    const data = { champion_stats: champions };
    toCache(role, data);
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Could not reach OP.GG MCP' });
  }
}
