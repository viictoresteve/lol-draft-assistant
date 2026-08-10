import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store, Action } from '@ngrx/store';
import { switchMap, map, catchError, withLatestFrom, startWith, debounceTime, tap, filter } from 'rxjs/operators';
import { of, Observable, EMPTY, from } from 'rxjs';
import * as DraftActions from './draft.actions';
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
import { AiService } from '@core/services/ai/ai.service';
import { DraftRole, DraftSide } from '@features/draft/models/draft.interface';

const SESSION_KEY = 'lol-draft-state';
// Cross-session preference: the role/side you main, so you never re-select it.
const PREFS_KEY = 'lol-draft-prefs';

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
          DraftActions.removeAllyPick,
          DraftActions.removeEnemyPick,
          DraftActions.setUserRole,
          DraftActions.setSide,
          DraftActions.retryAnalysis,
          // Token-saving: suggestions only need to react to picks + role/side.
          // Bans no longer re-run the AI (banned champs are filtered client-side
          // in the suggestions panel), and pool edits don't either (the "in your
          // pool ★" is client-side). Bans/pool are still read into the prompt on
          // the next pick — they just no longer each trigger a fresh 2.2k call.
        ),
        debounceTime(1200),  // suggestions: first to fire (coalesce rapid picks)
        withLatestFrom(
          this.store.select(selectAllPicks),
          this.store.select(selectAllyBans),
          this.store.select(selectEnemyBans),
          this.store.select(selectUserRole),
          this.store.select(selectByRole),
          this.store.select(selectSide),
          this.store.select(selectCompSummary),
        ),
        // Only spend a call while you still need to pick: no role, or your own
        // slot is already filled → suggestions are moot, so skip the AI entirely.
        filter(([, allPicks, , , userRole]) => {
          if (!userRole) return false;
          const alreadyPicked = allPicks.allyPicks.some((p) => p.role === userRole && p.champion);
          return !alreadyPicked;
        }),
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
          return total >= 7; // wait until the comp is mostly formed — fewer re-runs
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
            if (raw) return of(DraftActions.loadDraftSuccess(JSON.parse(raw)));

            // New session (no saved draft) → restore the role/side you main so
            // the app opens ready-to-use with zero clicks.
            const prefsRaw = localStorage.getItem(PREFS_KEY);
            if (prefsRaw) {
              const prefs = JSON.parse(prefsRaw) as { userRole?: DraftRole | null; side?: DraftSide };
              const actions: Action[] = [];
              if (prefs.userRole) actions.push(DraftActions.setUserRole({ role: prefs.userRole }));
              if (prefs.side) actions.push(DraftActions.setSide({ side: prefs.side }));
              if (actions.length) return from(actions);
            }
            return EMPTY;
          } catch {
            return EMPTY;
          }
        }),
      ),
  );

  // Persist role + side to localStorage as a cross-session preference.
  savePrefs$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(DraftActions.setUserRole, DraftActions.setSide),
        withLatestFrom(this.store.select(selectDraftForSave)),
        tap(([_, draft]) => {
          try {
            localStorage.setItem(PREFS_KEY, JSON.stringify({ userRole: draft.userRole, side: draft.side }));
          } catch {
            /* ignore */
          }
        }),
      ),
    { dispatch: false },
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

  // Lazy: only fires when the user opens the Tips tab (requestChampionTips),
  // not automatically on every pick — saves an AI call when tips go unseen.
  analyzeChampionTips$ = createEffect(
    (): Observable<Action> =>
      this.actions$.pipe(
        ofType(DraftActions.requestChampionTips),
        debounceTime(200),
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
