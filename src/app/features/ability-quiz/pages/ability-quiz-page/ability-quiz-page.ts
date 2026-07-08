import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { AbilityQuizService } from '@features/ability-quiz/services/ability-quiz.service';
import { LanguageService } from '@core/services/language.service';
import { Champion } from '@shared/models/champion.interface';
import { ImgFallbackDirective } from '@shared/directives/img-fallback.directive';
import { LeaderboardComponent } from '@shared/components/leaderboard/leaderboard.component';
import {
  AbilitySlot, ABILITY_SLOTS, SLOT_META,
} from '@features/ability-quiz/models/ability-quiz.interface';

@Component({
  selector: 'app-ability-quiz-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImgFallbackDirective, LeaderboardComponent],
  templateUrl: './ability-quiz-page.html',
  styleUrl: './ability-quiz-page.scss',
})
export class AbilityQuizPage {
  quiz = inject(AbilityQuizService);
  ls = inject(LanguageService);

  readonly slots = ABILITY_SLOTS;
  readonly SLOT_META = SLOT_META;

  // state passthrough
  phase       = this.quiz.phase;
  round       = this.quiz.round;
  roundLabel  = this.quiz.roundLabel;
  isLastRound = this.quiz.isLastRound;
  score       = this.quiz.score;
  maxScore    = this.quiz.maxScore;
  outcomes    = this.quiz.outcomes;
  loading     = this.quiz.loading;
  error       = this.quiz.error;
  current     = this.quiz.current;
  outcome     = this.quiz.outcome;
  hintUsed    = this.quiz.hintUsed;
  stats       = this.quiz.stats;

  // local guess state
  searchTerm     = signal('');
  guessedChampion = signal<Champion | null>(null);
  guessedSlot     = signal<AbilitySlot | null>(null);

  canSubmit = computed(() => this.guessedChampion() !== null && this.guessedSlot() !== null);

  searchResults = computed(() => {
    const term = this.searchTerm();
    if (!term) return [];
    return this.quiz.searchChampions(term);
  });

  matchRank = computed(() => {
    const pct = this.maxScore() > 0 ? this.score() / this.maxScore() : 0;
    if (pct >= 0.9)  return { label: 'S', color: '#0ac8b9' };
    if (pct >= 0.75) return { label: 'A', color: '#7ec87a' };
    if (pct >= 0.6)  return { label: 'B', color: '#c89b3c' };
    if (pct >= 0.4)  return { label: 'C', color: '#d08030' };
    return { label: 'D', color: '#e06060' };
  });

  start() {
    this.resetGuess();
    this.quiz.startGame();
  }

  pickChampion(c: Champion) {
    this.guessedChampion.set(c);
    this.searchTerm.set('');
  }

  pickSlot(s: AbilitySlot) {
    if (!this.outcome()) this.guessedSlot.set(s);
  }

  clearChampion() { this.guessedChampion.set(null); }

  submit() {
    if (!this.canSubmit()) return;
    this.quiz.submit(this.guessedChampion()!.id, this.guessedSlot());
  }

  next() {
    this.resetGuess();
    this.quiz.next();
  }

  quit() {
    this.resetGuess();
    this.quiz.quitToMenu();
  }

  retryRound() {
    this.resetGuess();
    this.quiz.retryRound();
  }

  useHint() { this.quiz.useHint(); }

  private resetGuess() {
    this.searchTerm.set('');
    this.guessedChampion.set(null);
    this.guessedSlot.set(null);
  }
}
