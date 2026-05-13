import { createAction, props } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';

export const addToPool = createAction('[Pool] Add Champion', props<{ champion: Champion }>());

export const removeFromPool = createAction(
  '[Pool] Remove Champion',
  props<{ championId: string }>(),
);

export const loadPool = createAction('[Pool] Load Pool');

export const loadPoolSuccess = createAction(
  '[Pool] Load Pool Success',
  props<{ champions: Champion[] }>(),
);

export const savePool = createAction('[Pool] Save Pool');
