import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DraftState } from '@features/draft/models/draft.interface';

export const selectDraftState = createFeatureSelector<DraftState>('draft');

export const selectAllyPicks = createSelector(selectDraftState, (state) => state.allyPicks);

export const selectEnemyPicks = createSelector(selectDraftState, (state) => state.enemyPicks);

export const selectAllyBans = createSelector(selectDraftState, (state) => state.allyBans);

export const selectEnemyBans = createSelector(selectDraftState, (state) => state.enemyBans);

export const selectSuggestions = createSelector(selectDraftState, (state) => state.suggestions);

export const selectIsAnalyzing = createSelector(selectDraftState, (state) => state.isAnalyzing);

export const selectAllPicks = createSelector(
  selectAllyPicks,
  selectEnemyPicks,
  (allyPicks, enemyPicks) => ({ allyPicks, enemyPicks }),
);
