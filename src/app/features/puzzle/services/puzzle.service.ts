import { Injectable, inject, signal, computed } from '@angular/core';
import { AiService } from '@core/services/ai.service';
import { DraftRole } from '@features/draft/models/draft.interface';
import {
  DraftPuzzle, PuzzleResult, PuzzleChampion, PuzzleDifficulty, PuzzleAnswer,
  AttemptRecord, RoundResult, MatchPhase, TOTAL_ROUNDS, HARDCORE_MULTIPLIER,
  computeRoundPoints, applyRealDataFloor,
} from '@features/puzzle/models/puzzle.interface';

export type RoleChoice = DraftRole | 'random';
const ALL_ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

const STATS_KEY = 'lol-puzzle-stats';

interface PuzzleStats {
  bestMatchScore: number;
  matchesPlayed: number;
  perfectCount: number;
}

@Injectable({ providedIn: 'root' })
export class PuzzleService {
  private ai = inject(AiService);

  readonly totalRounds = TOTAL_ROUNDS;

  // ── Match state ──
  phase        = signal<MatchPhase>('idle');
  round        = signal(0);          // 0-indexed current round
  matchScore   = signal(0);
  roundResults = signal<RoundResult[]>([]);
  difficulty   = signal<PuzzleDifficulty>('medium');
  roleChoice   = signal<RoleChoice>('random');
  hintsEnabled = signal(true);
  /** The role actually used for the current round (resolves 'random') */
  activeRole   = signal<DraftRole>('mid');

  // ── Current puzzle ──
  puzzle      = signal<DraftPuzzle | null>(null);
  result      = signal<PuzzleResult | null>(null);
  generating  = signal(false);
  grading     = signal(false);
  error       = signal<string | null>(null);

  attempts      = signal<AttemptRecord[]>([]);
  revealedHints = signal(0);

  stats = signal<PuzzleStats>(this.loadStats());

  isLastRound = computed(() => this.round() >= this.totalRounds - 1);
  roundLabel  = computed(() => `${this.round() + 1} / ${this.totalRounds}`);

  lastAttempt = computed<AttemptRecord | null>(() => {
    const a = this.attempts();
    return a.length > 0 ? a[a.length - 1] : null;
  });

  // Max points achievable this match (for the final grade)
  maxMatchScore = computed(() =>
    this.totalRounds * 100 * (this.hintsEnabled() ? 1 : HARDCORE_MULTIPLIER),
  );

  // ── Match lifecycle ──

  startMatch() {
    this.phase.set('playing');
    this.round.set(0);
    this.matchScore.set(0);
    this.roundResults.set([]);
    this.loadRound();
  }

  private loadRound(retriesLeft = 2) {
    this.error.set(null);
    this.result.set(null);
    this.puzzle.set(null);
    this.attempts.set([]);
    this.revealedHints.set(0);
    this.generating.set(true);

    // Resolve the role for this round (random picks a fresh role each round)
    const choice = this.roleChoice();
    const role: DraftRole = choice === 'random'
      ? ALL_ROLES[Math.floor(Math.random() * ALL_ROLES.length)]
      : choice;
    this.activeRole.set(role);

    this.ai.generatePuzzle(this.difficulty(), role).subscribe({
      next: (p) => {
        if (p) {
          this.generating.set(false);
          this.puzzle.set(p);
        } else if (retriesLeft > 0) {
          // Puzzle was rejected (e.g. wrong-role picks) — regenerate silently
          this.loadRound(retriesLeft - 1);
        } else {
          this.generating.set(false);
          this.error.set('Could not generate a valid puzzle. Try again.');
        }
      },
      error: (err) => {
        this.generating.set(false);
        this.error.set(
          err?.status === 401 ? 'NO_API_KEY' :
          err?.status === 429 ? 'RATE_LIMITED' :
          'Failed to generate puzzle.',
        );
      },
    });
  }

  /** Retry generating the current round (after an error) */
  retryRound() { this.loadRound(); }

  nextRound() {
    if (this.isLastRound()) {
      this.finishMatch();
    } else {
      this.round.update((r) => r + 1);
      this.loadRound();
    }
  }

  private finishMatch() {
    this.phase.set('summary');
    const perfects = this.roundResults().filter(r => r.grade === 'perfect' && !r.gaveUp).length;
    this.stats.update((st) => {
      const next: PuzzleStats = {
        bestMatchScore: Math.max(st.bestMatchScore, this.matchScore()),
        matchesPlayed: st.matchesPlayed + 1,
        perfectCount: st.perfectCount + perfects,
      };
      this.saveStats(next);
      return next;
    });
  }

  quitToMenu() {
    this.phase.set('idle');
    this.puzzle.set(null);
    this.result.set(null);
    this.attempts.set([]);
    this.revealedHints.set(0);
  }

  // ── Per-puzzle guessing ──

  submitPick(champion: PuzzleChampion) {
    const puzzle = this.puzzle();
    if (!puzzle || this.result()) return;
    if (this.attempts().some(a => a.champion.id.toLowerCase() === champion.id.toLowerCase())) return;

    const known = puzzle.answers.find((a) => a.championId.toLowerCase() === champion.id.toLowerCase());
    if (known) { this.handleAttempt(champion, known); return; }

    this.grading.set(true);
    this.ai.gradePick(puzzle, champion.name).subscribe({
      next: (answer) => { this.grading.set(false); this.handleAttempt(champion, answer); },
      error: () => {
        this.grading.set(false);
        this.handleAttempt(champion, {
          championId: champion.id, championName: champion.name,
          grade: 'questionable', reason: 'Could not evaluate — likely an off-meta or situational pick.',
        });
      },
    });
  }

  private handleAttempt(champion: PuzzleChampion, rawAnswer: PuzzleAnswer) {
    // Real OP.GG data overrides the AI when they disagree
    const answer = this.groundAnswer(champion, rawAnswer);
    this.attempts.update((a) => [...a, { champion, grade: answer.grade, reason: answer.reason }]);

    const isWin = answer.grade === 'perfect' || answer.grade === 'great';
    if (isWin) {
      this.finishRound(answer.grade, answer.reason, champion, false);
    } else if (this.hintsEnabled()) {
      const puzzle = this.puzzle()!;
      this.revealedHints.update((h) => Math.min(h + 1, puzzle.hints.length));
    }
    // hints disabled → no hint revealed, player just retries
  }

  /**
   * Real OP.GG lane win rates override the AI when they clearly disagree.
   * We only prevent false negatives: a champion with a proven >53% WR vs the
   * enemy laner is never graded "trap"/"questionable" (counters = lane truth).
   * We never downgrade on lane data alone, since the AI also weighs comp fit.
   */
  private groundAnswer(champion: PuzzleChampion, answer: PuzzleAnswer): PuzzleAnswer {
    const puzzle = this.puzzle();
    if (!puzzle) return answer;

    const norm = (s: string) => s.toLowerCase().replace(/['\s.]/g, '');
    let wr = answer.realWinRate;
    if (wr == null && puzzle.realCounters) {
      const match = puzzle.realCounters.find(
        (c) => norm(c.name) === norm(champion.id) || norm(c.name) === norm(champion.name),
      );
      wr = match?.winRate;
    }
    if (wr == null) return answer;

    const floored = applyRealDataFloor(answer.grade, wr);
    if (floored !== answer.grade) {
      return {
        ...answer,
        realWinRate: wr,
        grade: floored,
        reason: `${answer.reason} — OP.GG: ${wr}% WR vs ${puzzle.enemyLaner}`,
      };
    }
    return { ...answer, realWinRate: wr };
  }

  giveUp() {
    const puzzle = this.puzzle();
    if (!puzzle || this.result()) return;
    const best = this.bestAnswer();
    this.finishRound(best.grade, best.reason, { id: best.championId, name: best.championName }, true);
  }

  private finishRound(grade: PuzzleAnswer['grade'], reason: string, champion: PuzzleChampion, gaveUp: boolean) {
    const wrongTries = this.attempts().filter(a => a.grade !== 'perfect' && a.grade !== 'great').length;
    const points = computeRoundPoints(grade, wrongTries, this.hintsEnabled(), gaveUp);

    this.matchScore.update((s) => s + points);

    this.result.set({
      champion, grade, reason, points,
      attempts: this.attempts().length,
      hintsUsed: this.revealedHints(),
      gaveUp,
      bestAnswer: this.bestAnswer(),
    });

    this.roundResults.update((rs) => [...rs, {
      round: this.round() + 1, champion, grade, points, gaveUp, attempts: this.attempts().length,
    }]);
  }

  private bestAnswer(): PuzzleAnswer {
    const puzzle = this.puzzle()!;
    const order = ['perfect', 'great', 'good', 'questionable', 'trap'];
    return [...puzzle.answers].sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade))[0];
  }

  private loadStats(): PuzzleStats {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        // migrate older shape gracefully
        return {
          bestMatchScore: p.bestMatchScore ?? 0,
          matchesPlayed: p.matchesPlayed ?? 0,
          perfectCount: p.perfectCount ?? 0,
        };
      }
    } catch {}
    return { bestMatchScore: 0, matchesPlayed: 0, perfectCount: 0 };
  }

  private saveStats(s: PuzzleStats) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
  }
}
