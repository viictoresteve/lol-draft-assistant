import { Champion } from '../../../shared/models/champion.interface';

export type DraftRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export interface DraftPick {
  role: DraftRole;
  champion: Champion | null;
}

export interface DraftState {
  allyPicks: DraftPick[];
  allyBans: Champion[];
  enemyPicks: DraftPick[];
  enemyBans: Champion[];
  suggestions: Suggestion[];
  isAnalyzing: boolean;
}

export interface Suggestion {
  champion: Champion;
  reason: string;
  isInPool: boolean;
}
