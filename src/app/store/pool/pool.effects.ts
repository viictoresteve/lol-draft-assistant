import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, tap, withLatestFrom } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import * as PoolActions from './pool.actions';
import { selectPoolChampions } from './pool.selectors';

const POOL_STORAGE_KEY = 'lol-draft-champion-pool';

@Injectable()
export class PoolEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);

  loadPool$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PoolActions.loadPool),
      map(() => {
        const stored = localStorage.getItem(POOL_STORAGE_KEY);
        const champions = stored ? JSON.parse(stored) : [];
        return PoolActions.loadPoolSuccess({ champions });
      }),
    ),
  );

  savePool$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(PoolActions.addToPool, PoolActions.removeFromPool),
        withLatestFrom(this.store.select(selectPoolChampions)),
        tap(([_, champions]) => {
          localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(champions));
        }),
      ),
    { dispatch: false },
  );
}
