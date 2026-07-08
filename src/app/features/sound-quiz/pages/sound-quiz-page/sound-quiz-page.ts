import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { SoundQuizService } from '@features/sound-quiz/services/sound-quiz.service';
import { LanguageService } from '@core/services/language.service';
import { Champion } from '@shared/models/champion.interface';
import { ImgFallbackDirective } from '@shared/directives/img-fallback.directive';

@Component({
  selector: 'app-sound-quiz-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImgFallbackDirective],
  templateUrl: './sound-quiz-page.html',
  styleUrl: './sound-quiz-page.scss',
})
export class SoundQuizPage {
  quiz = inject(SoundQuizService);
  ls = inject(LanguageService);

  // state passthrough
  phase       = this.quiz.phase;
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
  isPlaying   = this.quiz.isPlaying;
  stats       = this.quiz.stats;

  searchTerm      = signal('');
  guessedChampion = signal<Champion | null>(null);

  canSubmit = computed(() => this.guessedChampion() !== null);

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

  start()  { this.resetGuess(); this.quiz.startGame(); }
  play()   { this.quiz.play(); }
  useHint(){ this.quiz.useHint(); }

  pickChampion(c: Champion) { this.guessedChampion.set(c); this.searchTerm.set(''); }
  clearChampion() { this.guessedChampion.set(null); }

  submit() {
    if (!this.canSubmit()) return;
    this.quiz.submit(this.guessedChampion()!.id);
  }

  next()       { this.resetGuess(); this.quiz.next(); }
  quit()       { this.resetGuess(); this.quiz.quitToMenu(); }
  retryRound() { this.resetGuess(); this.quiz.retryRound(); }

  private resetGuess() {
    this.searchTerm.set('');
    this.guessedChampion.set(null);
  }
}
