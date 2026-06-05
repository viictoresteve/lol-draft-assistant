import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store, Action } from '@ngrx/store';
import { switchMap, map, catchError, withLatestFrom, startWith, debounceTime, tap, filter } from 'rxjs/operators';
import { of, Observable, EMPTY } from 'rxjs';
import * as DraftActions from './draft.actions';
import * as PoolActions from '@store/pool/pool.actions';
import {
  selectAllPicks,
  selectAllyBans,
  selectEnemyBans,
  selectUserRole,
  selectSide,
  selectDraftForSave,
  selectCompSummary,
} from './draft.selectors';
import { distinctUntilChanged } from 'rxjs/operators';
import { selectByRole } from '@store/pool/pool.selectors';
import { AiService } from '@core/services/ai.service';

const SESSION_KEY = 'lol-draft-state';

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
          DraftActions.removeAllyBan,
          DraftActions.removeEnemyBan,
          DraftActions.setUserRole,
          DraftActions.setSide,
          DraftActions.retryAnalysis,
          PoolActions.addToPool,
          PoolActions.removeFromPool,
        ),
        debounceTime(900),  // suggestions: first to fire
        withLatestFrom(
          this.store.select(selectAllPicks),
          this.store.select(selectAllyBans),
          this.store.select(selectEnemyBans),
          this.store.select(selectUserRole),
          this.store.select(selectByRole),
          this.store.select(selectSide),
          this.store.select(selectCompSummary),
        ),
        switchMap(([_, allPicks, allyBans, enemyBans, userRole, byRole, side, compSummary]) => {
          const poolChampions = userRole
            ? byRole[userRole].map((c) => c.name)
            : Object.values(byRole).flat().map((c) => c.name);
          return this.aiService
            .analyzeDraft({
              allyPicks: allPicks.allyPicks,
              enemyPicks: allPicks.enemyPicks,
              allyBans,
              enemyBans,
              userRole: userRole ?? undefined,
              poolChampions,
              side,
              allyCompName: compSummary?.allyCompName,
              enemyCompName: compSummary?.enemyCompName,
            })
            .pipe(
              map((suggestions) => DraftActions.analyzeDraftSuccess({ suggestions })),
              catchError((err) => {
                const msg =
                  err?.status === 401 ? 'NO_API_KEY' :
                  err?.status === 429 ? 'RATE_LIMITED' :
                  (err?.message ?? 'AI request failed');
                return of(DraftActions.analyzeDraftFailure({ error: msg }));
              }),
              startWith(DraftActions.analyzeDraft()),
            );
        }),
      ),
  );

  analyzeGameplay$ = createEffect(
    (): Observable<Action> =>
      this.actions$.pipe(
        ofType(
          DraftActions.addAllyPick,
          DraftActions.addEnemyPick,
          DraftActions.setUserRole,
          DraftActions.retryAnalysis,
        ),
        debounceTime(3500),  // gameplay tips: fires last (only when all 10 picks)
        withLatestFrom(
          this.store.select(selectAllPicks),
          this.store.select(selectUserRole),
          this.store.select(selectSide),
        ),
        filter(([_, allPicks, userRole]) =>
          userRole !== null &&
          allPicks.allyPicks.every((p) => p.champion !== null) &&
          allPicks.enemyPicks.every((p) => p.champion !== null),
        ),
        switchMap(([_, allPicks, userRole, side]) =>
          this.aiService
            .analyzeGameplay({
              allyPicks: allPicks.allyPicks,
              enemyPicks: allPicks.enemyPicks,
              userRole: userRole!,
              side: side ?? 'blue',
            })
            .pipe(
              map((tips) => DraftActions.loadGameplayTipsSuccess({ tips })),
              catchError((error) =>
                of(DraftActions.loadGameplayTipsFailure({ error: error.message })),
              ),
              startWith(DraftActions.loadGameplayTips()),
            ),
        ),
      ),
  );

  analyzeCompSummary$ = createEffect(
    (): Observable<Action> =>
      this.actions$.pipe(
        ofType(DraftActions.addAllyPick, DraftActions.addEnemyPick, DraftActions.retryAnalysis),
        debounceTime(2200),  // comp summary: fires second, after suggestions
        withLatestFrom(this.store.select(selectAllPicks)),
        filter(([_, allPicks]) => {
          const total =
            allPicks.allyPicks.filter((p) => p.champion).length +
            allPicks.enemyPicks.filter((p) => p.champion).length;
          return total >= 5;
        }),
        switchMap(([_, allPicks]) =>
          this.aiService
            .analyzeCompSummary({
              allyPicks: allPicks.allyPicks,
              enemyPicks: allPicks.enemyPicks,
            })
            .pipe(
              map((summary) => DraftActions.loadCompSummarySuccess({ summary })),
              catchError(() => of(DraftActions.loadCompSummaryFailure())),
              startWith(DraftActions.loadCompSummary()),
            ),
        ),
      ),
  );

  loadDraft$ = createEffect(
    (): Observable<Action> =>
      this.actions$.pipe(
        ofType(DraftActions.loadDraft),
        switchMap(() => {
          try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return EMPTY;
            return of(DraftActions.loadDraftSuccess(JSON.parse(raw)));
          } catch {
            return EMPTY;
          }
        }),
      ),
  );

  saveDraft$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          DraftActions.addAllyPick,
          DraftActions.removeAllyPick,
          DraftActions.addEnemyPick,
          DraftActions.removeEnemyPick,
          DraftActions.addAllyBan,
          DraftActions.addEnemyBan,
          DraftActions.removeAllyBan,
          DraftActions.removeEnemyBan,
          DraftActions.setUserRole,
          DraftActions.setSide,
          DraftActions.resetDraft,
        ),
        withLatestFrom(this.store.select(selectDraftForSave)),
        tap(([_, draft]) => {
          try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft));
          } catch {}
        }),
      ),
    { dispatch: false },
  );

  // Fires when the user's own champion is set in the draft
  analyzeChampionTips$ = createEffect(
    (): Observable<Action> =>
      this.actions$.pipe(
        ofType(
          DraftActions.addAllyPick,
          DraftActions.setUserRole,
          DraftActions.loadDraftSuccess,
          DraftActions.restoreDraft,
          DraftActions.retryAnalysis,
        ),
        debounceTime(700),
        withLatestFrom(
          this.store.select(selectAllPicks),
          this.store.select(selectUserRole),
        ),
        // Only proceed when the user has a role AND their champion is picked
        filter(([_, allPicks, userRole]) => {
          if (!userRole) return false;
          const pick = allPicks.allyPicks.find((p) => p.role === userRole);
          return !!pick?.champion;
        }),
        // Avoid refiring for the same champion
        distinctUntilChanged(([_a, allPicksA, roleA], [_b, allPicksB, roleB]) => {
          const champA = allPicksA.allyPicks.find((p) => p.role === roleA)?.champion?.id;
          const champB = allPicksB.allyPicks.find((p) => p.role === roleB)?.champion?.id;
          return champA === champB && roleA === roleB;
        }),
        switchMap(([_, allPicks, userRole]) => {
          const pick = allPicks.allyPicks.find((p) => p.role === userRole)!;
          return this.aiService
            .analyzeChampionTips({
              champion: pick.champion!,
              role: userRole!,
              allyPicks: allPicks.allyPicks,
              enemyPicks: allPicks.enemyPicks,
            })
            .pipe(
              map((tips) => DraftActions.loadChampionTipsSuccess({ tips })),
              catchError(() => of(DraftActions.loadChampionTipsFailure())),
              startWith(DraftActions.loadChampionTips()),
            );
        }),
      ),
  );
}
