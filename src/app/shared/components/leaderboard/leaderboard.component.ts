import { Component, ChangeDetectionStrategy, OnInit, inject, input, signal } from '@angular/core';
import { LanguageService } from '@core/services/language.service';
import { LeaderboardService, LeaderboardGame, LeaderboardEntry } from '@core/services/leaderboard.service';

/**
 * Self-contained global leaderboard for a mini-game summary: shows the top
 * scores and, when the player scored, lets them submit their name once.
 * Degrades silently to an "unavailable" note if the backend isn't configured.
 */
@Component({
  selector: 'app-leaderboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit {
  private lb = inject(LeaderboardService);
  ls = inject(LanguageService);

  game = input.required<LeaderboardGame>();
  score = input<number>(0);

  entries    = signal<LeaderboardEntry[]>([]);
  loading    = signal(true);
  failed     = signal(false);
  submitting = signal(false);
  submitted  = signal(false);
  name       = signal(this.lb.playerName());

  ngOnInit() { this.load(); }

  private load() {
    this.loading.set(true);
    this.lb.getTop(this.game()).subscribe((entries) => {
      this.entries.set(entries);
      this.loading.set(false);
    });
  }

  submit() {
    const n = this.name().trim();
    if (!n || this.submitting() || this.submitted()) return;
    this.submitting.set(true);
    this.lb.submit(this.game(), n, this.score()).subscribe((entries) => {
      this.entries.set(entries);
      this.submitting.set(false);
      this.submitted.set(true);
      this.failed.set(entries.length === 0);
    });
  }

  isMe(entry: LeaderboardEntry, i: number): boolean {
    return this.submitted() && entry.name === this.name().trim() && entry.score === this.score()
      // highlight only the first matching row
      && this.entries().findIndex((e) => e.name === entry.name) === i;
  }
}
