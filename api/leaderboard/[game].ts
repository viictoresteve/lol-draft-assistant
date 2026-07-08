import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

/**
 * Global leaderboard for the mini-games, backed by an Upstash Redis sorted set
 * (one per game: `lb:puzzle`, `lb:abilities`, `lb:sounds`). Requires the
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars (set in Vercel).
 *
 *   GET  /api/leaderboard/:game        → top 20 { name, score }
 *   POST /api/leaderboard/:game  body: { name, score } → stores the player's best
 */

const GAMES = new Set(['puzzle', 'abilities', 'sounds']);
const MAX_ENTRIES = 20;

function redisOrNull(): Redis | null {
  if (!process.env['UPSTASH_REDIS_REST_URL'] || !process.env['UPSTASH_REDIS_REST_TOKEN']) return null;
  return Redis.fromEnv();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const game = String(req.query['game'] ?? '').toLowerCase();
  if (!GAMES.has(game)) { res.status(400).json({ error: 'Unknown game' }); return; }

  const redis = redisOrNull();
  if (!redis) { res.status(503).json({ error: 'Leaderboard not configured', entries: [] }); return; }

  const key = `lb:${game}`;

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      const name = String(body.name ?? '').trim().slice(0, 20).replace(/[<>]/g, '');
      const score = Math.max(0, Math.min(100000, Math.round(Number(body.score))));
      if (!name || !Number.isFinite(score)) { res.status(400).json({ error: 'Invalid entry' }); return; }

      // Keep only the player's best score (GT = update only if greater).
      await redis.zadd(key, { gt: true }, { score, member: name });
      // Trim to the top MAX_ENTRIES so the set can't grow without bound.
      await redis.zremrangebyrank(key, 0, -(MAX_ENTRIES + 1));
    }

    const raw = (await redis.zrange(key, 0, MAX_ENTRIES - 1, { rev: true, withScores: true })) as (string | number)[];
    const entries: { name: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ name: String(raw[i]), score: Number(raw[i + 1]) });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ entries });
  } catch {
    res.status(502).json({ error: 'Leaderboard unavailable', entries: [] });
  }
}
