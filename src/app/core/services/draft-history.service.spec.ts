import { TestBed } from '@angular/core/testing';
import { DraftHistoryService, DraftHistoryEntry } from './draft-history.service';
import { DraftPick } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';

const champ = (id: string): Champion => ({ id, name: id, title: '', image: '', tags: [] });
const pick = (role: DraftPick['role'], id: string | null): DraftPick => ({
  role,
  champion: id ? champ(id) : null,
});

const fullDraft = () => ({
  allyPicks: [pick('top', 'Ornn'), pick('mid', 'Ahri')],
  enemyPicks: [pick('top', 'Sett')],
  allyBans: [] as Champion[],
  enemyBans: [] as Champion[],
  userRole: 'mid' as const,
  side: 'blue' as const,
});

describe('DraftHistoryService', () => {
  let service: DraftHistoryService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DraftHistoryService);
  });

  it('saves a draft with >=2 picks and reads it back', () => {
    service.save(fullDraft());
    const all = service.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].userRole).toBe('mid');
    expect(all[0].id).toBeTruthy();
  });

  it('does NOT save near-empty drafts (<2 picks)', () => {
    service.save({
      allyPicks: [pick('mid', 'Ahri')],
      enemyPicks: [pick('top', null)],
      allyBans: [], enemyBans: [], userRole: null, side: 'blue',
    });
    expect(service.getAll()).toHaveLength(0);
  });

  it('caps history at 5 entries (most recent first)', () => {
    for (let i = 0; i < 7; i++) service.save(fullDraft());
    expect(service.getAll()).toHaveLength(5);
  });

  it('updates a result and computes win rate', () => {
    service.save(fullDraft());
    service.save(fullDraft());
    const [a, b] = service.getAll();
    service.updateResult(a.id, 'win');
    service.updateResult(b.id, 'loss');

    const wr = service.getWinRate();
    expect(wr.wins).toBe(1);
    expect(wr.losses).toBe(1);
    expect(wr.rate).toBe(50);
  });

  it('win rate is 0 when no results are recorded', () => {
    service.save(fullDraft());
    expect(service.getWinRate().rate).toBe(0);
  });

  it('formats relative time', () => {
    expect(service.timeAgo(Date.now())).toBe('Just now');
    expect(service.timeAgo(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(service.timeAgo(Date.now() - 3 * 3_600_000)).toBe('3h ago');
    expect(service.timeAgo(Date.now() - 2 * 86_400_000)).toBe('2d ago');
  });

  it('returns [] gracefully on corrupted storage', () => {
    localStorage.setItem('lol-draft-history', '{ not json');
    expect(service.getAll()).toEqual([] as DraftHistoryEntry[]);
  });
});
