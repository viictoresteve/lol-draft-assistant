import { createAction, props } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';
import { DraftRole } from '@features/draft/models/draft.interface';
import { RolePool } from '@features/champion-pool/models/pool.interface';

export const addToPool = createAction(
  '[Pool] Add Champion',
  props<{ champion: Champion; role: DraftRole }>(),
);

export const removeFromPool = createAction(
  '[Pool] Remove Champion',
  props<{ championId: string; role: DraftRole }>(),
);

export const loadPool = createAction('[Pool] Load Pool');

export const loadPoolSuccess = createAction(
  '[Pool] Load Pool Success',
  props<{ byRole: RolePool }>(),
);
