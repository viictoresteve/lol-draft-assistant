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

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

(app as any)._cacheForTests = cache;
export { app };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[proxy] Port ${PORT}  upstream=${OPGG_MCP_URL}`);
  });
}
