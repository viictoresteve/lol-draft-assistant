import { Champion } from '../../../shared/models/champion.interface';

export type DraftRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support';
export type DraftSide = 'blue' | 'red';

export interface DraftPick {
  role: DraftRole;
  champion: Champion | null;
}

export type ChampionTipType = 'mechanic' | 'synergy' | 'combo' | 'counterplay';

export interface ChampionTip {
  type: ChampionTipType;
  tip: string;
}

export interface CompSummary {
  allyCompName: string;
  enemyCompName: string;
  macroTips: string[];
}

export type GameplayPhase = 'early' | 'trade' | 'teamfight' | 'win' | 'danger';

export interface GameplayTip {
  phase: GameplayPhase;
  tip: string;
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
  gameplayTips: GameplayTip[];
  isLoadingTips: boolean;
  compSummary: CompSummary | null;
  isLoadingCompSummary: boolean;
  championTips: ChampionTip[];
  isLoadingChampionTips: boolean;
  error: string | null;
}

export interface BotlaneSynergy {
  id: string;
  name: string;
  synergy: string;
}

export interface Suggestion {
  champion: Champion;
  isInPool: boolean;
  summonerSpells: string[];
  tierInfo: string;
  pros: string[];
  cons: string[];
  botlanePairs: BotlaneSynergy[];
}
