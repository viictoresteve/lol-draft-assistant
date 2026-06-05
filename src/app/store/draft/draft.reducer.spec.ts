import { draftReducer, initialState } from './draft.reducer';
import * as DraftActions from './draft.actions';
import { DraftState, Suggestion, GameplayTip, CompSummary } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';

const mockChampion: Champion = {
  id: 'Orianna',
  name: 'Orianna',
  title: 'The Lady of Clockwork',
  image: 'https://example.com/Orianna.png',
  tags: ['Mage'],
};

const mockSuggestion: Suggestion = {
  champion: mockChampion,
  isInPool: false,
  tierInfo: 'A-tier · 51% WR',
  summonerSpells: ['Flash', 'Barrier'],
  pros: ['Strong poke'],
  cons: [],
  botlanePairs: [],
};

const mockTip: GameplayTip = { phase: 'early', tip: 'Push hard level 1-3' };

const mockCompSummary: CompSummary = {
  allyCompName: 'Poke Siege',
  enemyCompName: 'Dive Comp',
  macroTips: ['Force fights before level 6'],
};

describe('DraftReducer', () => {
  it('returns initialState for unknown action', () => {
    const state = draftReducer(undefined, { type: '@@INIT' } as any);
    expect(state).toEqual(initialState);
  });

  // ── setUserRole ──────────────────────────────────────────────────────────

  it('setUserRole sets the role and clears suggestions + gameplayTips', () => {
    const base: DraftState = {
      ...initialState,
      suggestions: [mockSuggestion],
      gameplayTips: [mockTip],
      userRole: null,
    };
    const result = draftReducer(base, DraftActions.setUserRole({ role: 'mid' }));

    expect(result.userRole).toBe('mid');
    expect(result.suggestions).toEqual([]);
    expect(result.gameplayTips).toEqual([]);
  });

  it('setUserRole with null clears role', () => {
    const base = { ...initialState, userRole: 'mid' as const };
    const result = draftReducer(base, DraftActions.setUserRole({ role: null }));
    expect(result.userRole).toBeNull();
  });

  // ── analyzeDraft ─────────────────────────────────────────────────────────

  it('analyzeDraft clears suggestions, sets isAnalyzing, clears error', () => {
    const base: DraftState = {
      ...initialState,
      suggestions: [mockSuggestion],
      error: 'previous error',
    };
    const result = draftReducer(base, DraftActions.analyzeDraft());
    expect(result.suggestions).toEqual([]);
    expect(result.isAnalyzing).toBe(true);
    expect(result.error).toBeNull();
  });

  it('analyzeDraftSuccess stores suggestions and stops loading', () => {
    const base = { ...initialState, isAnalyzing: true };
    const result = draftReducer(
      base,
      DraftActions.analyzeDraftSuccess({ suggestions: [mockSuggestion] }),
    );
    expect(result.suggestions).toHaveLength(1);
    expect(result.isAnalyzing).toBe(false);
    expect(result.error).toBeNull();
  });

  it('analyzeDraftFailure stores error and stops loading', () => {
    const base = { ...initialState, isAnalyzing: true };
    const result = draftReducer(
      base,
      DraftActions.analyzeDraftFailure({ error: 'Network error' }),
    );
    expect(result.isAnalyzing).toBe(false);
    expect(result.error).toBe('Network error');
    expect(result.suggestions).toEqual([]);
  });

  // ── removeAllyPick / removeEnemyPick ──────────────────────────────────────

  it('removeAllyPick clears champion, gameplayTips, and compSummary', () => {
    const base: DraftState = {
      ...initialState,
      allyPicks: initialState.allyPicks.map((p) =>
        p.role === 'mid' ? { ...p, champion: mockChampion } : p,
      ),
      gameplayTips: [mockTip],
      compSummary: mockCompSummary,
    };
    const result = draftReducer(base, DraftActions.removeAllyPick({ role: 'mid' }));

    expect(result.allyPicks.find((p) => p.role === 'mid')?.champion).toBeNull();
    expect(result.gameplayTips).toEqual([]);
    expect(result.compSummary).toBeNull();
  });

  it('removeEnemyPick clears compSummary', () => {
    const base: DraftState = { ...initialState, compSummary: mockCompSummary };
    const result = draftReducer(base, DraftActions.removeEnemyPick({ role: 'top' }));
    expect(result.compSummary).toBeNull();
  });

  // ── Comp summary ─────────────────────────────────────────────────────────

  it('loadCompSummary sets loading flag and clears previous summary', () => {
    const base = { ...initialState, compSummary: mockCompSummary };
    const result = draftReducer(base, DraftActions.loadCompSummary());
    expect(result.isLoadingCompSummary).toBe(true);
    expect(result.compSummary).toBeNull();
  });

  it('loadCompSummarySuccess stores summary and stops loading', () => {
    const base = { ...initialState, isLoadingCompSummary: true };
    const result = draftReducer(
      base,
      DraftActions.loadCompSummarySuccess({ summary: mockCompSummary }),
    );
    expect(result.compSummary).toEqual(mockCompSummary);
    expect(result.isLoadingCompSummary).toBe(false);
  });

  it('loadCompSummaryFailure stops loading', () => {
    const base = { ...initialState, isLoadingCompSummary: true };
    const result = draftReducer(base, DraftActions.loadCompSummaryFailure());
    expect(result.isLoadingCompSummary).toBe(false);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it('loadDraftSuccess restores picks/bans/role/side, clears AI state', () => {
    const savedPicks = initialState.allyPicks.map((p) =>
      p.role === 'adc' ? { ...p, champion: mockChampion } : p,
    );
    const result = draftReducer(
      { ...initialState, suggestions: [mockSuggestion] },
      DraftActions.loadDraftSuccess({
        allyPicks: savedPicks,
        enemyPicks: initialState.enemyPicks,
        allyBans: [],
        enemyBans: [],
        userRole: 'adc',
        side: 'red',
      }),
    );
    expect(result.allyPicks.find((p) => p.role === 'adc')?.champion?.id).toBe('Orianna');
    expect(result.userRole).toBe('adc');
    expect(result.side).toBe('red');
    expect(result.suggestions).toEqual([]);
    expect(result.isAnalyzing).toBe(false);
  });

  // ── resetDraft ────────────────────────────────────────────────────────────

  it('resetDraft returns exact initialState', () => {
    const dirty: DraftState = {
      ...initialState,
      suggestions: [mockSuggestion],
      gameplayTips: [mockTip],
      compSummary: mockCompSummary,
      error: 'some error',
      userRole: 'top',
    };
    expect(draftReducer(dirty, DraftActions.resetDraft())).toEqual(initialState);
  });
});
