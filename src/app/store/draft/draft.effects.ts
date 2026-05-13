import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store, Action } from '@ngrx/store';
import { switchMap, map, catchError, withLatestFrom } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import * as DraftActions from './draft.actions';
import { selectAllPicks, selectAllyBans, selectEnemyBans } from './draft.selectors';
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
        ),
        withLatestFrom(
          this.store.select(selectAllPicks),
          this.store.select(selectAllyBans),
          this.store.select(selectEnemyBans),
        ),
        switchMap(([_, allPicks, allyBans, enemyBans]) =>
          this.aiService
            .analyzeDraft({
              allyPicks: allPicks.allyPicks,
              enemyPicks: allPicks.enemyPicks,
              allyBans,
              enemyBans,
            })
            .pipe(
              map((suggestions) => DraftActions.analyzeDraftSuccess({ suggestions })),
              catchError((error) =>
                of(
                  DraftActions.analyzeDraftFailure({
                    error: error.message,
                  }),
                ),
              ),
            ),
        ),
      ),
  );
}
