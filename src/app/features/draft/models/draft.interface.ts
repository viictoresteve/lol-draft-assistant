import { Champion } from '../../../shared/models/champion.interface';

export type DraftRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support';
export type DraftSide = 'blue' | 'red';

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
  userRole: DraftRole | null;
  side: DraftSide;
}

export interface Suggestion {
  champion: Champion;
  reason: string;
  isInPool: boolean;
  summonerSpells: string[];
}
