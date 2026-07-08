import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Global leaderboard for the mini-games, backed by an Upstash Redis sorted set
 * (one per game: `lb:puzzle`, `lb:abilities`, `lb:sounds`).
 *
 * Talks to the Upstash REST API directly with `fetch` (no SDK dependency, so
 * nothing extra to bundle into the serverless function). Reads the REST
 * credentials from whichever names the Upstash/Vercel integration provisioned:
 * `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `_TOKEN`.
 *
 *   GET  /api/leaderboard/:game        → top 20 { name, score }
 *   POST /api/leaderboard/:game  body: { name, score } → stores the player's best
 */

const GAMES = new Set(['puzzle', 'abilities', 'sounds']);
const MAX_ENTRIES = 20;

function creds(): { url: string; token: string } | null {
  const url = process.env['UPSTASH_REDIS_REST_URL'] ?? process.env['KV_REST_API_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'] ?? process.env['KV_REST_API_TOKEN'];
  return url && token ? { url, token } : null;
}

/** Run a single Redis command via the Upstash REST API. */
async function redis(url: string, token: string, command: (string | number)[]): Promise<unknown> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const json = (await r.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const game = String(req.query['game'] ?? '').toLowerCase();
  if (!GAMES.has(game)) { res.status(400).json({ error: 'Unknown game' }); return; }

  const c = creds();
  if (!c) { res.status(503).json({ error: 'Leaderboard not configured', entries: [] }); return; }

  const key = `lb:${game}`;

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      const name = String(body.name ?? '').trim().slice(0, 20).replace(/[<>]/g, '');
      const score = Math.max(0, Math.min(100000, Math.round(Number(body.score))));
      if (!name || !Number.isFinite(score)) { res.status(400).json({ error: 'Invalid entry' }); return; }

      // Keep only the player's best score (GT = update only if greater)…
      await redis(c.url, c.token, ['ZADD', key, 'GT', score, name]);
      // …and cap the set to the top MAX_ENTRIES.
      await redis(c.url, c.token, ['ZREMRANGEBYRANK', key, 0, -(MAX_ENTRIES + 1)]);
    }

    const raw = (await redis(c.url, c.token, ['ZRANGE', key, 0, MAX_ENTRIES - 1, 'REV', 'WITHSCORES'])) as string[];
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
