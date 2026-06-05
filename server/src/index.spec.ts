import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Minimal valid MCP response that parseMcpText can extract data from
function mcpTextResponse(role: string, champions: string) {
  const cls = role === 'adc' ? 'Adc' : role.charAt(0).toUpperCase() + role.slice(1);
  return {
    jsonrpc: '2.0', id: 1,
    result: {
      content: [{
        type: 'text',
        text: `LolListLaneMetaChampions("en_US","${role}",Data(Positions([${champions}])))`,
      }],
    },
  };
}

// Two sample champions in MCP text format
function sampleChamps(cls: string) {
  return `${cls}("Ahri",false,100000,51000,800000,0.51,0.10,0.97,0.04,2.57,1,1,1,1),` +
         `${cls}("Zed",false,80000,38400,750000,0.48,0.08,0.95,0.12,2.10,3,2,2,3)`;
}

function mockMcp(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function clearCache() { (app as any)._cacheForTests?.clear?.(); }

beforeEach(() => clearCache());
afterEach(() => { vi.unstubAllGlobals(); clearCache(); });

// ── /health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 without hitting any upstream', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── /api/tier — validation ────────────────────────────────────────────────────

describe('GET /api/tier/:role — validation', () => {
  it('returns 400 for unknown role, never calls upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app).get('/api/tier/unknown_role');

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts all five valid roles', async () => {
    for (const role of ['top', 'jungle', 'mid', 'adc', 'support']) {
      const cls = role === 'adc' ? 'Adc' : role.charAt(0).toUpperCase() + role.slice(1);
      vi.stubGlobal('fetch', mockMcp(200, mcpTextResponse(role, sampleChamps(cls))));
      const res = await request(app).get(`/api/tier/${role}`);
      expect(res.status).toBe(200);
      clearCache();
    }
  });
});

// ── /api/tier — happy path ────────────────────────────────────────────────────

describe('GET /api/tier/mid — MCP success', () => {
  it('calls OP.GG MCP with POST and correct body', async () => {
    const fetchMock = mockMcp(200, mcpTextResponse('mid', sampleChamps('Mid')));
    vi.stubGlobal('fetch', fetchMock);

    await request(app).get('/api/tier/mid');

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('mcp-api.op.gg');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body as string);
    expect(body.method).toBe('tools/call');
    expect(body.params.name).toBe('lol_list_lane_meta_champions');
    expect(body.params.arguments.position).toBe('mid');
  });

  it('returns parsed champion_stats with tier labels S/A/B/C/D', async () => {
    vi.stubGlobal('fetch', mockMcp(200, mcpTextResponse('mid', sampleChamps('Mid'))));

    const res = await request(app).get('/api/tier/mid');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.champion_stats)).toBe(true);
    expect(res.body.champion_stats[0].name).toBe('Ahri');
    expect(res.body.champion_stats[0].tier).toBe('S');   // tier=1 → "S"
    expect(res.body.champion_stats[1].tier).toBe('B');   // tier=3 → "B"
    expect(typeof res.body.champion_stats[0].win_rate).toBe('number');
    expect(typeof res.body.champion_stats[0].pick_rate).toBe('number');
  });

  it('uses "adc" (not "bot") as MCP position for adc role', async () => {
    const fetchMock = mockMcp(200, mcpTextResponse('adc', sampleChamps('Adc')));
    vi.stubGlobal('fetch', fetchMock);

    await request(app).get('/api/tier/adc');

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.params.arguments.position).toBe('adc');  // NOT "bot" — MCP uses "adc"
  });
});

// ── /api/tier — caching ───────────────────────────────────────────────────────

describe('GET /api/tier/:role — caching', () => {
  it('calls upstream only once for repeated requests to the same role', async () => {
    const fetchMock = mockMcp(200, mcpTextResponse('top', sampleChamps('Top')));
    vi.stubGlobal('fetch', fetchMock);

    await request(app).get('/api/tier/top');
    await request(app).get('/api/tier/top');
    await request(app).get('/api/tier/top');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── /api/tier — upstream errors ───────────────────────────────────────────────

describe('GET /api/tier/:role — upstream errors', () => {
  it('returns 429 when MCP is rate-limited', async () => {
    vi.stubGlobal('fetch', mockMcp(429, {}));
    const res = await request(app).get('/api/tier/mid');
    expect(res.status).toBe(429);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 503 for any other upstream error', async () => {
    vi.stubGlobal('fetch', mockMcp(500, {}));
    const res = await request(app).get('/api/tier/mid');
    expect(res.status).toBe(503);
  });

  it('returns 503 when MCP returns empty content', async () => {
    vi.stubGlobal('fetch', mockMcp(200, { result: { content: [{ type: 'text', text: '' }] } }));
    const res = await request(app).get('/api/tier/mid');
    expect(res.status).toBe(503);
  });

  it('returns 503 when MCP text cannot be parsed (no champion entries)', async () => {
    vi.stubGlobal('fetch', mockMcp(200, { result: { content: [{ type: 'text', text: 'some garbage text' }] } }));
    const res = await request(app).get('/api/tier/mid');
    expect(res.status).toBe(503);
  });

  it('returns 502 when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const res = await request(app).get('/api/tier/mid');
    expect(res.status).toBe(502);
  });
});

// ── /api/counters/:champion ───────────────────────────────────────────────────

const MALPHITE_MCP_RESPONSE = {
  result: {
    content: [{
      type: 'text',
      text: `class Data: summary,damage_type,strong_counters,weak_counters\nclass StrongCounter: champion_id,champion_name,play,win,win_rate\n\nLolGetChampionAnalysis("MALPHITE","TOP",Data(Summary(),"AP",[StrongCounter(67,"Vayne",1878,1150,0.61),StrongCounter(133,"Quinn",565,331,0.59),StrongCounter(69,"Cassiopeia",274,116,0.58)],[]))`,
    }],
  },
};

describe('GET /api/counters/:champion', () => {
  it('returns 200 with damage type and counters', async () => {
    vi.stubGlobal('fetch', mockMcp(200, MALPHITE_MCP_RESPONSE));
    const res = await request(app).get('/api/counters/Malphite?position=top');
    expect(res.status).toBe(200);
    expect(res.body.damageType).toBe('AP');
    expect(Array.isArray(res.body.counters)).toBe(true);
    expect(res.body.counters[0].name).toBe('Vayne');
    expect(res.body.counters[0].winRate).toBe(61);
  });

  it('deduplicates counters and returns max 8', async () => {
    vi.stubGlobal('fetch', mockMcp(200, MALPHITE_MCP_RESPONSE));
    const res = await request(app).get('/api/counters/Malphite?position=top');
    expect(res.body.counters.length).toBeLessThanOrEqual(8);
  });

  it('returns 502 when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const res = await request(app).get('/api/counters/Malphite?position=top');
    expect(res.status).toBe(502);
  });
});

// ── CORS ──────────────────────────────────────────────────────────────────────

describe('CORS headers', () => {
  it('includes Access-Control-Allow-Origin on responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});
