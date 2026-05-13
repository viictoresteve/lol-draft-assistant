import { createReducer, on } from '@ngrx/store';
import { PoolState } from '@features/champion-pool/models/pool.interface';
import * as PoolActions from './pool.actions';

export const initialState: PoolState = {
  champions: [],
};

export const poolReducer = createReducer(
  initialState,

  on(PoolActions.addToPool, (state, { champion }) => ({
    ...state,
    champions: [...state.champions, champion],
  })),

  on(PoolActions.removeFromPool, (state, { championId }) => ({
    ...state,
    champions: state.champions.filter((c) => c.id !== championId),
  })),

  on(PoolActions.loadPoolSuccess, (state, { champions }) => ({
    ...state,
    champions,
  })),
);
