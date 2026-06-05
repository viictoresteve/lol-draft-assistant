import { createReducer, on } from '@ngrx/store';
import { PoolState, RolePool } from '@features/champion-pool/models/pool.interface';
import * as PoolActions from './pool.actions';

export const EMPTY_BY_ROLE: RolePool = {
  top: [],
  jungle: [],
  mid: [],
  adc: [],
  support: [],
};

export const initialState: PoolState = { byRole: { ...EMPTY_BY_ROLE } };

export const poolReducer = createReducer(
  initialState,

  on(PoolActions.addToPool, (state, { champion, role }) => {
    const current = state.byRole[role];
    if (current.some((c) => c.id === champion.id)) return state;
    return {
      ...state,
      byRole: { ...state.byRole, [role]: [...current, champion] },
    };
  }),

  on(PoolActions.removeFromPool, (state, { championId, role }) => ({
    ...state,
    byRole: {
      ...state.byRole,
      [role]: state.byRole[role].filter((c) => c.id !== championId),
    },
  })),

  on(PoolActions.loadPoolSuccess, (state, { byRole }) => ({
    ...state,
    byRole,
  })),
);
