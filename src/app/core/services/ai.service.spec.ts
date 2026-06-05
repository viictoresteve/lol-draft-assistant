import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AiService } from './ai.service';

function makeResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

describe('AiService', () => {
  let service: AiService;
  let priv: any; // access private methods under test

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiService);
    priv = service as any;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── parseResponse ──────────────────────────────────────────────────────────

  describe('parseResponse', () => {
    it('parses a valid suggestion array', () => {
      const raw = [
        {
          championId: 'Orianna',
          championName: 'Orianna',
          tierInfo: 'A-tier · 51% WR',
          summonerSpells: ['Flash', 'Barrier'],
          pros: ['Shockwave counters dive', 'Great teamfight'],
          cons: ['Weak early'],
          botlanePairs: [],
        },
      ];
      const result = priv.parseResponse(makeResponse(JSON.stringify(raw)));
      expect(result).toHaveLength(1);
      expect(result[0].champion.id).toBe('Orianna');
      expect(result[0].tierInfo).toBe('A-tier · 51% WR');
      expect(result[0].pros).toHaveLength(2);
      expect(result[0].cons).toHaveLength(1);
    });

    it('sanitizes champion IDs — removes spaces', () => {
      const raw = [{ championId: 'Miss Fortune', championName: 'Miss Fortune', tierInfo: '', summonerSpells: [], pros: [], cons: [], botlanePairs: [] }];
      const result = priv.parseResponse(makeResponse(JSON.stringify(raw)));
      expect(result[0].champion.id).toBe('MissFortune');
      expect(result[0].champion.image).toContain('MissFortune');
    });

    it('sanitizes champion IDs — removes apostrophes', () => {
      const raw = [{ championId: "K'Sante", championName: "K'Sante", tierInfo: '', summonerSpells: [], pros: [], cons: [], botlanePairs: [] }];
      const result = priv.parseResponse(makeResponse(JSON.stringify(raw)));
      expect(result[0].champion.id).toBe('KSante');
    });

    it('caps pros at 4 items', () => {
      const raw = [{ championId: 'Ahri', championName: 'Ahri', tierInfo: '', summonerSpells: [], pros: ['a', 'b', 'c', 'd', 'e'], cons: [], botlanePairs: [] }];
      const result = priv.parseResponse(makeResponse(JSON.stringify(raw)));
      expect(result[0].pros).toHaveLength(4);
    });

    it('caps cons at 2 items', () => {
      const raw = [{ championId: 'Ahri', championName: 'Ahri', tierInfo: '', summonerSpells: [], pros: [], cons: ['a', 'b', 'c'], botlanePairs: [] }];
      const result = priv.parseResponse(makeResponse(JSON.stringify(raw)));
      expect(result[0].cons).toHaveLength(2);
    });

    it('caps botlanePairs at 3 items', () => {
      const pairs = [
        { id: 'Thresh', name: 'Thresh', synergy: 's1' },
        { id: 'Nautilus', name: 'Nautilus', synergy: 's2' },
        { id: 'Leona', name: 'Leona', synergy: 's3' },
        { id: 'Blitzcrank', name: 'Blitzcrank', synergy: 's4' },
      ];
      const raw = [{ championId: 'Caitlyn', championName: 'Caitlyn', tierInfo: '', summonerSpells: [], pros: [], cons: [], botlanePairs: pairs }];
      const result = priv.parseResponse(makeResponse(JSON.stringify(raw)));
      expect(result[0].botlanePairs).toHaveLength(3);
    });

    it('returns [] for invalid JSON', () => {
      expect(priv.parseResponse(makeResponse('not json at all'))).toEqual([]);
    });

    it('returns [] for empty content', () => {
      expect(priv.parseResponse(makeResponse(''))).toEqual([]);
    });

    it('strips markdown code block wrapper', () => {
      const raw = [{ championId: 'Zed', championName: 'Zed', tierInfo: '', summonerSpells: [], pros: [], cons: [], botlanePairs: [] }];
      const wrapped = `\`\`\`json\n${JSON.stringify(raw)}\n\`\`\``;
      const result = priv.parseResponse(makeResponse(wrapped));
      expect(result).toHaveLength(1);
      expect(result[0].champion.id).toBe('Zed');
    });
  });

  // ── parseCompSummaryResponse ───────────────────────────────────────────────

  describe('parseCompSummaryResponse', () => {
    it('parses valid comp summary', () => {
      const raw = {
        allyCompName: 'Triple Engage',
        enemyCompName: 'Protect the Carry',
        macroTips: ['Force fights early', 'Invade jungle', 'Dragon priority'],
      };
      const result: any = priv.parseCompSummaryResponse(makeResponse(JSON.stringify(raw)));
      expect(result.allyCompName).toBe('Triple Engage');
      expect(result.enemyCompName).toBe('Protect the Carry');
      expect(result.macroTips).toHaveLength(3);
    });

    it('caps macroTips at 4 items', () => {
      const raw = {
        allyCompName: 'Poke',
        enemyCompName: 'Dive',
        macroTips: ['t1', 't2', 't3', 't4', 't5'],
      };
      const result: any = priv.parseCompSummaryResponse(makeResponse(JSON.stringify(raw)));
      expect(result.macroTips).toHaveLength(4);
    });

    it('returns empty object on invalid JSON', () => {
      const result: any = priv.parseCompSummaryResponse(makeResponse('bad json'));
      expect(result.allyCompName).toBe('');
      expect(result.enemyCompName).toBe('');
      expect(result.macroTips).toEqual([]);
    });
  });

  // ── parseGameplayResponse ──────────────────────────────────────────────────

  describe('parseGameplayResponse', () => {
    it('parses valid gameplay tips', () => {
      const raw = [
        { phase: 'early', tip: 'Push hard pre-6' },
        { phase: 'danger', tip: 'Watch for hook at level 6' },
      ];
      const result: any = priv.parseGameplayResponse(makeResponse(JSON.stringify(raw)));
      expect(result).toHaveLength(2);
      expect(result[0].phase).toBe('early');
    });

    it('defaults unknown phase to early', () => {
      const raw = [{ phase: 'unknown_phase', tip: 'Some tip' }];
      const result: any = priv.parseGameplayResponse(makeResponse(JSON.stringify(raw)));
      expect(result[0].phase).toBe('early');
    });

    it('caps tip length at 120 characters', () => {
      const longTip = 'a'.repeat(200);
      const raw = [{ phase: 'early', tip: longTip }];
      const result: any = priv.parseGameplayResponse(makeResponse(JSON.stringify(raw)));
      expect(result[0].tip.length).toBe(120);
    });

    it('returns [] on invalid JSON', () => {
      expect(priv.parseGameplayResponse(makeResponse('invalid'))).toEqual([]);
    });
  });
});
