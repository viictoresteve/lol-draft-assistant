import { Component, ChangeDetectionStrategy, OnInit, inject, input, signal } from '@angular/core';
import { LanguageService } from '@core/services/language.service';
import { LeaderboardService, LeaderboardGame, LeaderboardEntry, MatchRound } from '@core/services/leaderboard.service';
import { ToastService } from '@core/services/toast.service';
import { PatchService } from '@core/services/patch.service';
import { ImgFallbackDirective } from '@shared/directives/img-fallback.directive';

/**
 * Self-contained global leaderboard for a mini-game summary: shows the top
 * scores and, when the player scored, lets them submit their name once.
 * Degrades silently to an "unavailable" note if the backend isn't configured.
 */
@Component({
  selector: 'app-leaderboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImgFallbackDirective],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit {
  private lb = inject(LeaderboardService);
  private toast = inject(ToastService);
  private patch = inject(PatchService);
  ls = inject(LanguageService);

  game = input.required<LeaderboardGame>();
  score = input<number>(0);
  /** The just-played match, submitted alongside the score so others can view it. */
  match = input<MatchRound[]>([]);

  entries    = signal<LeaderboardEntry[]>([]);
  loading    = signal(true);
  failed     = signal(false);
  submitting = signal(false);
  submitted  = signal(false);
  name       = signal(this.lb.playerName());

  // Expandable per-player match history
  openPlayer   = signal<string | null>(null);
  matchRounds  = signal<MatchRound[]>([]);
  matchLoading = signal(false);

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
    this.lb.submit(this.game(), n, this.score(), this.match()).subscribe((entries) => {
      this.entries.set(entries);
      this.submitting.set(false);
      this.submitted.set(true);
      this.failed.set(entries.length === 0);
      if (entries.length === 0) {
        this.toast.error(this.ls.T().lbUnavailable);
      } else {
        this.toast.success(this.ls.T().lbSubmitted);
      }
    });
  }

  isMe(entry: LeaderboardEntry, i: number): boolean {
    return this.submitted() && entry.name === this.name().trim() && entry.score === this.score()
      // highlight only the first matching row
      && this.entries().findIndex((e) => e.name === entry.name) === i;
  }

  /** Expand a row to show that player's round-by-round history (or collapse it). */
  toggleDetail(name: string) {
    if (this.openPlayer() === name) { this.openPlayer.set(null); return; }
    this.openPlayer.set(name);
    this.matchRounds.set([]);
    this.matchLoading.set(true);
    this.lb.getMatch(this.game(), name).subscribe((rounds) => {
      if (this.openPlayer() === name) {
        this.matchRounds.set(rounds);
        this.matchLoading.set(false);
      }
    });
  }

  icon(id: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.patch.version()}/img/champion/${id}.png`;
  }
}
