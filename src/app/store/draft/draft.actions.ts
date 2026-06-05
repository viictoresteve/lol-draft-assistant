import { createAction, props } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';
import { DraftRole, DraftSide, DraftPick, Suggestion, GameplayTip, CompSummary, ChampionTip } from '@features/draft/models/draft.interface';

// Pick actions
export const addAllyPick = createAction(
  '[Draft] Add Ally Pick',
  props<{ champion: Champion; role: DraftRole }>(),
);
export const removeAllyPick = createAction('[Draft] Remove Ally Pick', props<{ role: DraftRole }>());
export const addEnemyPick = createAction(
  '[Draft] Add Enemy Pick',
  props<{ champion: Champion; role: DraftRole }>(),
);
export const removeEnemyPick = createAction('[Draft] Remove Enemy Pick', props<{ role: DraftRole }>());

// Ban actions
export const addAllyBan = createAction('[Draft] Add Ally Ban', props<{ champion: Champion }>());
export const addEnemyBan = createAction('[Draft] Add Enemy Ban', props<{ champion: Champion }>());
export const removeAllyBan = createAction('[Draft] Remove Ally Ban', props<{ championId: string }>());
export const removeEnemyBan = createAction('[Draft] Remove Enemy Ban', props<{ championId: string }>());

// AI actions
export const analyzeDraft = createAction('[Draft] Analyze Draft');
export const analyzeDraftSuccess = createAction(
  '[Draft] Analyze Draft Success',
  props<{ suggestions: Suggestion[] }>(),
);
export const analyzeDraftFailure = createAction(
  '[Draft] Analyze Draft Failure',
  props<{ error: string }>(),
);

// User role / side
export const setUserRole = createAction('[Draft] Set User Role', props<{ role: DraftRole | null }>());
export const setSide = createAction('[Draft] Set Side', props<{ side: DraftSide }>());

// Reset
export const resetDraft = createAction('[Draft] Reset Draft');

// Persistence
export const loadDraft = createAction('[Draft] Load Draft');
export const loadDraftSuccess = createAction(
  '[Draft] Load Draft Success',
  props<{
    allyPicks: DraftPick[];
    enemyPicks: DraftPick[];
    allyBans: Champion[];
    enemyBans: Champion[];
    userRole: DraftRole | null;
    side: DraftSide;
  }>(),
);

// Retry AI analysis
export const retryAnalysis = createAction('[Draft] Retry Analysis');

// Gameplay tips
export const loadGameplayTips = createAction('[Draft] Load Gameplay Tips');
export const loadGameplayTipsSuccess = createAction(
  '[Draft] Load Gameplay Tips Success',
  props<{ tips: GameplayTip[] }>(),
);
export const loadGameplayTipsFailure = createAction(
  '[Draft] Load Gameplay Tips Failure',
  props<{ error: string }>(),
);

// Comp summary
export const loadCompSummary = createAction('[Draft] Load Comp Summary');
export const loadCompSummarySuccess = createAction(
  '[Draft] Load Comp Summary Success',
  props<{ summary: CompSummary }>(),
);
export const loadCompSummaryFailure = createAction('[Draft] Load Comp Summary Failure');

// Champion tips (niche mechanics for the user's picked champion)
export const loadChampionTips = createAction('[Draft] Load Champion Tips');
export const loadChampionTipsSuccess = createAction(
  '[Draft] Load Champion Tips Success',
  props<{ tips: ChampionTip[] }>(),
);
export const loadChampionTipsFailure = createAction('[Draft] Load Champion Tips Failure');

// URL restore
export const restoreDraft = createAction(
  '[Draft] Restore Draft',
  props<{
    allyPicks: DraftPick[];
    enemyPicks: DraftPick[];
    allyBans: Champion[];
    enemyBans: Champion[];
    userRole: DraftRole | null;
    side: DraftSide;
  }>(),
);
