import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DraftState } from '@features/draft/models/draft.interface';

export const selectDraftState = createFeatureSelector<DraftState>('draft');

export const selectAllyPicks = createSelector(selectDraftState, (state) => state.allyPicks);

export const selectEnemyPicks = createSelector(selectDraftState, (state) => state.enemyPicks);

export const selectAllyBans = createSelector(selectDraftState, (state) => state.allyBans);

export const selectEnemyBans = createSelector(selectDraftState, (state) => state.enemyBans);

export const selectSuggestions = createSelector(selectDraftState, (state) => state.suggestions);

export const selectIsAnalyzing = createSelector(selectDraftState, (state) => state.isAnalyzing);

export const selectUserRole = createSelector(selectDraftState, (state) => state.userRole);

export const selectSide = createSelector(selectDraftState, (state) => state.side);

export const selectAllPicks = createSelector(
  selectAllyPicks,
  selectEnemyPicks,
  (allyPicks, enemyPicks) => ({ allyPicks, enemyPicks }),
);

export const selectGameplayTips = createSelector(selectDraftState, (s) => s.gameplayTips);
export const selectIsLoadingTips = createSelector(selectDraftState, (s) => s.isLoadingTips);
export const selectCompSummary = createSelector(selectDraftState, (s) => s.compSummary);
export const selectIsLoadingCompSummary = createSelector(selectDraftState, (s) => s.isLoadingCompSummary);
export const selectChampionTips = createSelector(selectDraftState, (s) => s.championTips);
export const selectIsLoadingChampionTips = createSelector(selectDraftState, (s) => s.isLoadingChampionTips);
export const selectDraftError = createSelector(selectDraftState, (s) => s.error);
export const selectIsDraftComplete = createSelector(
  selectAllyPicks,
  selectEnemyPicks,
  (ally, enemy) => ally.every((p) => p.champion !== null) && enemy.every((p) => p.champion !== null),
);

export const selectDraftForSave = createSelector(
  selectAllyPicks,
  selectEnemyPicks,
  selectAllyBans,
  selectEnemyBans,
  selectUserRole,
  selectSide,
  (allyPicks, enemyPicks, allyBans, enemyBans, userRole, side) => ({
    allyPicks,
    enemyPicks,
    allyBans,
    enemyBans,
    userRole,
    side,
  }),
);
