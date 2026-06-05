import { Champion } from '../../../shared/models/champion.interface';
import { DraftRole } from '../../draft/models/draft.interface';

export type RolePool = Record<DraftRole, Champion[]>;

export interface PoolState {
  byRole: RolePool;
}
