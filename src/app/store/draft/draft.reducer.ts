import { createReducer, on } from '@ngrx/store';
import { DraftState, DraftPick } from '@features/draft/models/draft.interface';
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
  })),

  on(DraftActions.addAllyBan, (state, { champion }) => ({
    ...state,
    allyBans: [...state.allyBans, champion],
  })),

  on(DraftActions.addEnemyBan, (state, { champion }) => ({
    ...state,
    enemyBans: [...state.enemyBans, champion],
  })),

  on(DraftActions.analyzeDraft, (state) => ({
    ...state,
    isAnalyzing: true,
  })),

  on(DraftActions.analyzeDraftSuccess, (state, { suggestions }) => ({
    ...state,
    suggestions,
    isAnalyzing: false,
  })),

  on(DraftActions.analyzeDraftFailure, (state) => ({
    ...state,
    isAnalyzing: false,
  })),

  on(DraftActions.resetDraft, () => initialState),
);
