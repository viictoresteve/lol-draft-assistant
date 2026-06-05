import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, tap, withLatestFrom } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import * as PoolActions from './pool.actions';
import { selectByRole } from './pool.selectors';
import { RolePool } from '@features/champion-pool/models/pool.interface';

const POOL_STORAGE_KEY = 'lol-draft-champion-pool-v2';

const EMPTY_BY_ROLE: RolePool = { top: [], jungle: [], mid: [], adc: [], support: [] };

@Injectable()
export class PoolEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);

  loadPool$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PoolActions.loadPool),
      map(() => {
        try {
          const stored = localStorage.getItem(POOL_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as RolePool;
            const byRole: RolePool = {
              top: Array.isArray(parsed.top) ? parsed.top : [],
              jungle: Array.isArray(parsed.jungle) ? parsed.jungle : [],
              mid: Array.isArray(parsed.mid) ? parsed.mid : [],
              adc: Array.isArray(parsed.adc) ? parsed.adc : [],
              support: Array.isArray(parsed.support) ? parsed.support : [],
            };
            return PoolActions.loadPoolSuccess({ byRole });
          }
        } catch {}
        return PoolActions.loadPoolSuccess({ byRole: { ...EMPTY_BY_ROLE } });
      }),
    ),
  );

  savePool$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(PoolActions.addToPool, PoolActions.removeFromPool),
        withLatestFrom(this.store.select(selectByRole)),
        tap(([_, byRole]) => {
          localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(byRole));
        }),
      ),
    { dispatch: false },
  );
}
