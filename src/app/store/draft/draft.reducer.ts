import { createReducer, on } from '@ngrx/store';
import { DraftState } from '@features/draft/models/draft.interface';
import * as DraftActions from './draft.actions';

export const initialState: DraftState = {
  allyPicks: [
    { role: 'top', champion: null },
    { role: 'jungle', champion: null },
    { role: 'mid', champion: null },
    { role: 'adc', champion: null },
    { role: 'support', champion: null },
  ],
  allyBans: [],
  enemyPicks: [
    { role: 'top', champion: null },
    { role: 'jungle', champion: null },
    { role: 'mid', champion: null },
    { role: 'adc', champion: null },
    { role: 'support', champion: null },
  ],
  enemyBans: [],
  suggestions: [],
  isAnalyzing: false,
  userRole: null,
  side: 'blue',
  gameplayTips: [],
  isLoadingTips: false,
  compSummary: null,
  isLoadingCompSummary: false,
  championTips: [],
  isLoadingChampionTips: false,
  error: null,
};

export const draftReducer = createReducer(
  initialState,

  on(DraftActions.addAllyPick, (state, { champion, role }) => ({
    ...state,
    allyPicks: state.allyPicks.map((pick) => (pick.role === role ? { ...pick, champion } : pick)),
  })),

  on(DraftActions.removeAllyPick, (state, { role }) => ({
    ...state,
    allyPicks: state.allyPicks.map((pick) =>
      pick.role === role ? { ...pick, champion: null } : pick,
    ),
    gameplayTips: [],
    compSummary: null,
  })),

  on(DraftActions.addEnemyPick, (state, { champion, role }) => ({
    ...state,
    enemyPicks: state.enemyPicks.map((pick) => (pick.role === role ? { ...pick, champion } : pick)),
  })),

  on(DraftActions.removeEnemyPick, (state, { role }) => ({
    ...state,
    enemyPicks: state.enemyPicks.map((pick) =>
      pick.role === role ? { ...pick, champion: null } : pick,
    ),
    gameplayTips: [],
    compSummary: null,
  })),

  on(DraftActions.addAllyBan, (state, { champion }) => ({
    ...state,
    allyBans: [...state.allyBans, champion],
  })),

  on(DraftActions.addEnemyBan, (state, { champion }) => ({
    ...state,
    enemyBans: [...state.enemyBans, champion],
  })),

  on(DraftActions.removeAllyBan, (state, { championId }) => ({
    ...state,
    allyBans: state.allyBans.filter((c) => c.id !== championId),
  })),

  on(DraftActions.removeEnemyBan, (state, { championId }) => ({
    ...state,
    enemyBans: state.enemyBans.filter((c) => c.id !== championId),
  })),

  on(
    DraftActions.loadDraftSuccess,
    DraftActions.restoreDraft,
    (state, { allyPicks, enemyPicks, allyBans, enemyBans, userRole, side }) => ({
      ...state,
      allyPicks,
      enemyPicks,
      allyBans,
      enemyBans,
      userRole,
      side,
      suggestions: [],
      isAnalyzing: false,
    }),
  ),

  on(DraftActions.analyzeDraft, (state) => ({
    ...state,
    isAnalyzing: true,
    error: null,
    suggestions: [],  // never show stale suggestions while loading
  })),

  on(DraftActions.analyzeDraftSuccess, (state, { suggestions }) => ({
    ...state,
    suggestions,
    isAnalyzing: false,
    error: null,
  })),

  on(DraftActions.analyzeDraftFailure, (state, { error }) => ({
    ...state,
    isAnalyzing: false,
    error,
  })),

  on(DraftActions.loadGameplayTips, (state) => ({
    ...state,
    isLoadingTips: true,
  })),

  on(DraftActions.loadGameplayTipsSuccess, (state, { tips }) => ({
    ...state,
    gameplayTips: tips,
    isLoadingTips: false,
  })),

  on(DraftActions.loadGameplayTipsFailure, (state) => ({
    ...state,
    isLoadingTips: false,
  })),

  on(DraftActions.loadCompSummary, (state) => ({
    ...state,
    isLoadingCompSummary: true,
    compSummary: null,
  })),

  on(DraftActions.loadCompSummarySuccess, (state, { summary }) => ({
    ...state,
    compSummary: summary,
    isLoadingCompSummary: false,
  })),

  on(DraftActions.loadCompSummaryFailure, (state) => ({
    ...state,
    isLoadingCompSummary: false,
  })),

  on(DraftActions.setUserRole, (state, { role }) => ({
    ...state,
    userRole: role,
    suggestions: [],
    gameplayTips: [],
    championTips: [],
  })),

  on(DraftActions.setSide, (state, { side }) => ({ ...state, side })),

  on(DraftActions.loadChampionTips, (state) => ({
    ...state, isLoadingChampionTips: true,
  })),
  on(DraftActions.loadChampionTipsSuccess, (state, { tips }) => ({
    ...state, championTips: tips, isLoadingChampionTips: false,
  })),
  on(DraftActions.loadChampionTipsFailure, (state) => ({
    ...state, isLoadingChampionTips: false,
  })),

  on(DraftActions.resetDraft, () => initialState),
);
