import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PoolState } from '@features/champion-pool/models/pool.interface';

export const selectPoolState = createFeatureSelector<PoolState>('pool');

export const selectPoolChampions = createSelector(selectPoolState, (state) => state.champions);

export const selectPoolChampionIds = createSelector(selectPoolChampions, (champions) =>
  champions.map((c) => c.id),
);

export const selectIsInPool = (championId: string) =>
  createSelector(selectPoolChampionIds, (ids) => ids.includes(championId));
