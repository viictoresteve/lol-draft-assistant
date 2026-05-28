import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store, Action } from '@ngrx/store';
import { switchMap, map, catchError, withLatestFrom, startWith, debounceTime } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import * as DraftActions from './draft.actions';
import { selectAllPicks, selectAllyBans, selectEnemyBans, selectUserRole, selectSide } from './draft.selectors';
import { selectPoolChampions } from '@store/pool/pool.selectors';
import { AiService } from '@core/services/ai.service';

@Injectable()
export class DraftEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private aiService = inject(AiService);

  analyzeDraft$ = createEffect(
    (): Observable<Action> =>
      this.actions$.pipe(
        ofType(
          DraftActions.addAllyPick,
          DraftActions.addEnemyPick,
          DraftActions.addAllyBan,
          DraftActions.addEnemyBan,
          DraftActions.setUserRole,
          DraftActions.setSide,
        ),
        debounceTime(1000),
        withLatestFrom(
          this.store.select(selectAllPicks),
          this.store.select(selectAllyBans),
          this.store.select(selectEnemyBans),
          this.store.select(selectUserRole),
          this.store.select(selectPoolChampions),
          this.store.select(selectSide),
        ),
        switchMap(([_, allPicks, allyBans, enemyBans, userRole, pool, side]) =>
          this.aiService
            .analyzeDraft({
              allyPicks: allPicks.allyPicks,
              enemyPicks: allPicks.enemyPicks,
              allyBans,
              enemyBans,
              userRole: userRole ?? undefined,
              poolChampions: pool.map((c) => c.name),
              side,
            })
            .pipe(
              map((suggestions) => DraftActions.analyzeDraftSuccess({ suggestions })),
              catchError((error) =>
                of(DraftActions.analyzeDraftFailure({ error: error.message })),
              ),
              startWith(DraftActions.analyzeDraft()),
            ),
        ),
      ),
  );
}
