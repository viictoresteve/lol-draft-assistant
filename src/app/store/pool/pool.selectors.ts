import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PoolState } from '@features/champion-pool/models/pool.interface';
import { DraftRole } from '@features/draft/models/draft.interface';

export const selectPoolState = createFeatureSelector<PoolState>('pool');

export const selectByRole = createSelector(selectPoolState, (state) => state.byRole);

export const selectPoolForRole = (role: DraftRole) =>
  createSelector(selectByRole, (byRole) => byRole[role]);

export const selectPoolChampions = createSelector(selectByRole, (byRole) =>
  Object.values(byRole).flat(),
);

export const selectPoolChampionIds = createSelector(selectPoolChampions, (champions) => [
  ...new Set(champions.map((c) => c.id)),
]);

export const selectIsInPool = (championId: string) =>
  createSelector(selectPoolChampionIds, (ids) => ids.includes(championId));
