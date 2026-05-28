import { createAction, props } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';
import { DraftRole, DraftSide, Suggestion } from '@features/draft/models/draft.interface';

// Pick actions
export const addAllyPick = createAction(
  '[Draft] Add Ally Pick',
  props<{ champion: Champion; role: DraftRole }>(),
);

export const removeAllyPick = createAction(
  '[Draft] Remove Ally Pick',
  props<{ role: DraftRole }>(),
);

export const addEnemyPick = createAction(
  '[Draft] Add Enemy Pick',
  props<{ champion: Champion; role: DraftRole }>(),
);

export const removeEnemyPick = createAction(
  '[Draft] Remove Enemy Pick',
  props<{ role: DraftRole }>(),
);

// Ban actions
export const addAllyBan = createAction('[Draft] Add Ally Ban', props<{ champion: Champion }>());

export const addEnemyBan = createAction('[Draft] Add Enemy Ban', props<{ champion: Champion }>());

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

// User role
export const setUserRole = createAction('[Draft] Set User Role', props<{ role: DraftRole | null }>());

// Side selection
export const setSide = createAction('[Draft] Set Side', props<{ side: DraftSide }>());

// Reset
export const resetDraft = createAction('[Draft] Reset Draft');
