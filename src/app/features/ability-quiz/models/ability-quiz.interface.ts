export type AbilitySlot = 'P' | 'Q' | 'W' | 'E' | 'R';

export const ABILITY_SLOTS: AbilitySlot[] = ['P', 'Q', 'W', 'E', 'R'];

export interface AbilityInfo {
  slot: AbilitySlot;
  name: string;
  description: string;
  iconUrl: string;
  /** Future audio mode — when we host ability sound clips */
  audioUrl?: string;
}

export interface QuizChampion {
  id: string;
  name: string;
  image: string;
}

/** One round: the player must name the champion + the ability slot */
export interface AbilityRound {
  champion: QuizChampion;
  ability: AbilityInfo;
  /** All abilities of the champion, for the reveal screen */
  allAbilities: AbilityInfo[];
}

export interface RoundOutcome {
  champion: QuizChampion;
  ability: AbilityInfo;
  guessedChampionId: string | null;
  guessedSlot: AbilitySlot | null;
  championCorrect: boolean;
  slotCorrect: boolean;
  hintUsed: boolean;
  points: number;
}

export type QuizPhase = 'idle' | 'playing' | 'summary';

export const TOTAL_QUIZ_ROUNDS = 10;
export const PTS_CHAMPION = 60;
export const PTS_SLOT = 40;
export const HINT_PENALTY = 25;

/** Pure scoring for one round (unit-tested). */
export function computeQuizPoints(
  championCorrect: boolean,
  slotCorrect: boolean,
  hintUsed: boolean,
): number {
  let pts = 0;
  if (championCorrect) pts += PTS_CHAMPION;
  if (slotCorrect) pts += PTS_SLOT;
  if (hintUsed) pts = Math.max(0, pts - HINT_PENALTY);
  return pts;
}

export const SLOT_META: Record<AbilitySlot, { label: string; color: string }> = {
  P: { label: 'Passive', color: '#a0a0c0' },
  Q: { label: 'Q', color: '#6aaaff' },
  W: { label: 'W', color: '#7ec87a' },
  E: { label: 'E', color: '#e0b050' },
  R: { label: 'R', color: '#e06060' },
};
