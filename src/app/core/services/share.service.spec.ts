import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { ShareService } from './share.service';

describe('ShareService.parseUrl', () => {
  let service: ShareService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Store, useValue: { select: () => ({ pipe: () => ({}) }) } }],
    });
    service = TestBed.inject(ShareService);
  });

  function encode(obj: unknown): string {
    return btoa(JSON.stringify(obj));
  }

  it('decodes a valid draft and lays out all 5 roles per team', () => {
    const encoded = encode({
      ap: [{ i: 'Ahri', n: 'Ahri', r: 'mid' }],
      ep: [{ i: 'Zed', n: 'Zed', r: 'mid' }],
      ab: [{ i: 'Yasuo', n: 'Yasuo' }],
      eb: [],
      s: 'red',
      r: 'mid',
    });

    const result = service.parseUrl(encoded);

    expect(result).not.toBeNull();
    expect(result!.allyPicks).toHaveLength(5);
    expect(result!.enemyPicks).toHaveLength(5);
    expect(result!.allyPicks.find((p) => p.role === 'mid')?.champion?.id).toBe('Ahri');
    expect(result!.enemyPicks.find((p) => p.role === 'mid')?.champion?.id).toBe('Zed');
    expect(result!.allyPicks.find((p) => p.role === 'top')?.champion).toBeNull();
    expect(result!.allyBans[0].name).toBe('Yasuo');
    expect(result!.side).toBe('red');
    expect(result!.userRole).toBe('mid');
  });

  it('defaults side to blue and role to null when absent', () => {
    const result = service.parseUrl(encode({ ap: [], ep: [], ab: [], eb: [] }));
    expect(result!.side).toBe('blue');
    expect(result!.userRole).toBeNull();
  });

  it('returns null for malformed base64 / invalid JSON', () => {
    expect(service.parseUrl('not-valid-base64!!!')).toBeNull();
    expect(service.parseUrl(btoa('{ broken json'))).toBeNull();
  });
});
