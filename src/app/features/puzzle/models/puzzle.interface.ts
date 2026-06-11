import { DraftRole, DraftSide } from '@features/draft/models/draft.interface';

export type PickGrade = 'perfect' | 'great' | 'good' | 'questionable' | 'trap';
export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';

export interface PuzzleChampion {
  id: string;
  name: string;
}

export interface PuzzlePick {
  role: DraftRole;
  champion: PuzzleChampion | null; // null = the slot to fill
}

export interface PuzzleAnswer {
  championId: string;
  championName: string;
  grade: PickGrade;
  reason: string;
  /** Real OP.GG lane win rate vs the enemy laner (0–100), if available */
  realWinRate?: number;
}

/** Minimal real-counter datum from OP.GG */
export interface RealCounter {
  name: string;
  winRate: number; // 0–100
}

export interface DraftPuzzle {
  id: string;
  difficulty: PuzzleDifficulty;
  scenario: string;
  missingTeam: 'ally' | 'enemy';
  missingRole: DraftRole;
  side: DraftSide; // side of the team that has the missing pick
  allyPicks: PuzzlePick[];
  enemyPicks: PuzzlePick[];
  allyBans: PuzzleChampion[];
  enemyBans: PuzzleChampion[];
  answers: PuzzleAnswer[]; // answer key (graded meta picks + traps)
  hints: string[];         // ordered subtle → obvious, revealed on wrong guesses
  // ── Real OP.GG data for the lane the player is filling ──
  enemyLaner?: string;       // enemy champion in the missing role
  enemyDamageType?: 'AP' | 'AD' | 'MIXED' | 'TRUE';
  realCounters?: RealCounter[]; // champions with proven WR vs the enemy laner
}

/** A single guess the player made */
export interface AttemptRecord {
  champion: PuzzleChampion;
  grade: PickGrade;
  reason: string;
}

export interface PuzzleResult {
  champion: PuzzleChampion;  // the winning (or given-up) pick
  grade: PickGrade;
  reason: string;
  points: number;
  attempts: number;          // total guesses made
  hintsUsed: number;
  gaveUp: boolean;
  bestAnswer: PuzzleAnswer;  // the ideal pick to reveal
}

/** Summary of one solved round, for the match recap screen */
export interface RoundResult {
  round: number;             // 1-indexed
  champion: PuzzleChampion;
  grade: PickGrade;
  points: number;
  gaveUp: boolean;
  attempts: number;
}

export type MatchPhase = 'idle' | 'playing' | 'summary';

export const TOTAL_ROUNDS = 5;
export const HARDCORE_MULTIPLIER = 1.3; // bonus for playing with hints off

// ── Scoring ──────────────────────────────────────────────────────────────────

export const GRADE_POINTS: Record<PickGrade, number> = {
  perfect: 100,
  great: 70,
  good: 40,
  questionable: 15,
  trap: 0,
};

export const GRADE_META: Record<PickGrade, { label: string; color: string; emoji: string }> = {
  perfect:      { label: 'Perfect',      color: '#0ac8b9', emoji: '🏆' },
  great:        { label: 'Great',        color: '#4a9a4a', emoji: '✓' },
  good:         { label: 'Good',         color: '#c89b3c', emoji: '○' },
  questionable: { label: 'Questionable', color: '#d08030', emoji: '?' },
  trap:         { label: 'Trap',         color: '#e84057', emoji: '✗' },
};

// ── Pure scoring/grounding logic (unit-tested) ──────────────────────────────

/** Points for one round. -20 per wrong try, floor 15, +30% in hardcore, 0 if gave up. */
export function computeRoundPoints(
  grade: PickGrade,
  wrongTries: number,
  hintsEnabled: boolean,
  gaveUp: boolean,
): number {
  if (gaveUp) return 0;
  const base = Math.max(15, GRADE_POINTS[grade] - wrongTries * 20);
  return Math.round(base * (hintsEnabled ? 1 : HARDCORE_MULTIPLIER));
}

/**
 * Real OP.GG lane win rate overrides the AI when they clearly disagree.
 * Only prevents false negatives: a proven >=53% WR counter is never "trap"/"questionable".
 * Never downgrades on lane data alone (the AI also weighs comp fit).
 */
export function applyRealDataFloor(grade: PickGrade, realWinRate: number | undefined): PickGrade {
  if (realWinRate != null && realWinRate >= 53 && (grade === 'trap' || grade === 'questionable')) {
    return 'good';
  }
  return grade;
}
