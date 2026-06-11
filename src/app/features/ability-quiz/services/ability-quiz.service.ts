import { Injectable, inject, signal, computed } from '@angular/core';
import { ChampionsService } from '@core/services/champions.service';
import { ChampionDetailService } from '@core/services/champion-detail.service';
import { Champion } from '@shared/models/champion.interface';
import {
  AbilityRound, RoundOutcome, QuizPhase, AbilitySlot,
  TOTAL_QUIZ_ROUNDS, computeQuizPoints,
} from '@features/ability-quiz/models/ability-quiz.interface';

const STATS_KEY = 'lol-ability-quiz-stats';

interface QuizStats {
  bestScore: number;
  gamesPlayed: number;
  perfectRounds: number;
}

@Injectable({ providedIn: 'root' })
export class AbilityQuizService {
  private champService = inject(ChampionsService);
  private detailService = inject(ChampionDetailService);

  readonly totalRounds = TOTAL_QUIZ_ROUNDS;

  phase        = signal<QuizPhase>('idle');
  round        = signal(0);
  score        = signal(0);
  outcomes     = signal<RoundOutcome[]>([]);
  loading      = signal(false);
  error        = signal<string | null>(null);

  current      = signal<AbilityRound | null>(null);
  outcome      = signal<RoundOutcome | null>(null);
  hintUsed     = signal(false);

  stats        = signal<QuizStats>(this.loadStats());

  private allChampions: Champion[] = [];
  private usedChampionIds = new Set<string>();

  roundLabel  = computed(() => `${this.round() + 1} / ${this.totalRounds}`);
  isLastRound = computed(() => this.round() >= this.totalRounds - 1);
  maxScore    = computed(() => this.totalRounds * 100);

  startGame() {
    this.phase.set('playing');
    this.round.set(0);
    this.score.set(0);
    this.outcomes.set([]);
    this.usedChampionIds.clear();
    this.loadChampionsThen(() => this.loadRound());
  }

  private loadChampionsThen(cb: () => void) {
    if (this.allChampions.length > 0) { cb(); return; }
    this.loading.set(true);
    this.champService.getChampions().subscribe({
      next: (champs) => { this.allChampions = champs; this.loading.set(false); cb(); },
      error: () => { this.loading.set(false); this.error.set('Failed to load champions.'); },
    });
  }

  private loadRound() {
    this.error.set(null);
    this.outcome.set(null);
    this.current.set(null);
    this.hintUsed.set(false);
    this.loading.set(true);

    const champ = this.pickRandomChampion();
    if (!champ) { this.loading.set(false); this.error.set('No champions available.'); return; }

    this.detailService.getAbilities(champ.id).subscribe({
      next: (abilities) => {
        this.loading.set(false);
        const valid = abilities.filter((a) => !!a.iconUrl && !a.iconUrl.endsWith('undefined'));
        if (valid.length === 0) { this.loadRound(); return; } // skip broken champ data
        const ability = valid[Math.floor(Math.random() * valid.length)];
        this.current.set({
          champion: { id: champ.id, name: champ.name, image: champ.image },
          ability,
          allAbilities: abilities,
        });
      },
      error: () => { this.loading.set(false); this.loadRound(); },
    });
  }

  private pickRandomChampion(): Champion | null {
    const pool = this.allChampions.filter((c) => !this.usedChampionIds.has(c.id));
    const src = pool.length > 0 ? pool : this.allChampions;
    if (src.length === 0) return null;
    const champ = src[Math.floor(Math.random() * src.length)];
    this.usedChampionIds.add(champ.id);
    return champ;
  }

  useHint() { this.hintUsed.set(true); }

  submit(guessedChampionId: string | null, guessedSlot: AbilitySlot | null) {
    const r = this.current();
    if (!r || this.outcome()) return;

    const championCorrect = guessedChampionId?.toLowerCase() === r.champion.id.toLowerCase();
    const slotCorrect = guessedSlot === r.ability.slot;
    const points = computeQuizPoints(championCorrect, slotCorrect, this.hintUsed());

    this.score.update((s) => s + points);

    const outcome: RoundOutcome = {
      champion: r.champion,
      ability: r.ability,
      guessedChampionId,
      guessedSlot,
      championCorrect,
      slotCorrect,
      hintUsed: this.hintUsed(),
      points,
    };
    this.outcome.set(outcome);
    this.outcomes.update((o) => [...o, outcome]);
  }

  next() {
    if (this.isLastRound()) {
      this.finishGame();
    } else {
      this.round.update((r) => r + 1);
      this.loadRound();
    }
  }

  private finishGame() {
    this.phase.set('summary');
    const perfects = this.outcomes().filter((o) => o.championCorrect && o.slotCorrect && !o.hintUsed).length;
    this.stats.update((st) => {
      const next: QuizStats = {
        bestScore: Math.max(st.bestScore, this.score()),
        gamesPlayed: st.gamesPlayed + 1,
        perfectRounds: st.perfectRounds + perfects,
      };
      this.saveStats(next);
      return next;
    });
  }

  quitToMenu() {
    this.phase.set('idle');
    this.current.set(null);
    this.outcome.set(null);
  }

  // Helper for the picker: search champions by name
  searchChampions(term: string): Champion[] {
    const t = term.toLowerCase().trim();
    if (!t) return [];
    return this.allChampions.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 30);
  }

  championPool(): Champion[] { return this.allChampions; }

  private loadStats(): QuizStats {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { bestScore: 0, gamesPlayed: 0, perfectRounds: 0 };
  }
  private saveStats(s: QuizStats) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
  }
}
