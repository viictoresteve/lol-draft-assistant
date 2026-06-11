import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PuzzleService } from '@features/puzzle/services/puzzle.service';
import { ChampionsService } from '@core/services/champions.service';
import { PatchService } from '@core/services/patch.service';
import { LanguageService } from '@core/services/language.service';
import { Champion } from '@shared/models/champion.interface';
import { DraftRole } from '@features/draft/models/draft.interface';
import {
  PuzzlePick, PuzzleChampion, PuzzleDifficulty, GRADE_META, PickGrade,
} from '@features/puzzle/models/puzzle.interface';

const ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

@Component({
  selector: 'app-puzzle-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './puzzle-page.html',
  styleUrl: './puzzle-page.scss',
})
export class PuzzlePage {
  puzzleService = inject(PuzzleService);
  private champService = inject(ChampionsService);
  private patchService = inject(PatchService);
  ls = inject(LanguageService);

  readonly roles = ROLES;
  readonly difficulties: PuzzleDifficulty[] = ['easy', 'medium', 'hard'];
  readonly GRADE_META = GRADE_META;

  // Match / game state passthrough
  phase         = this.puzzleService.phase;
  round         = this.puzzleService.round;
  roundLabel    = this.puzzleService.roundLabel;
  isLastRound   = this.puzzleService.isLastRound;
  matchScore    = this.puzzleService.matchScore;
  roundResults  = this.puzzleService.roundResults;
  maxMatchScore = this.puzzleService.maxMatchScore;
  hintsEnabled  = this.puzzleService.hintsEnabled;
  totalRounds   = this.puzzleService.totalRounds;

  puzzle        = this.puzzleService.puzzle;
  result        = this.puzzleService.result;
  generating    = this.puzzleService.generating;
  grading       = this.puzzleService.grading;
  error         = this.puzzleService.error;
  difficulty    = this.puzzleService.difficulty;
  stats         = this.puzzleService.stats;
  attempts      = this.puzzleService.attempts;
  revealedHints = this.puzzleService.revealedHints;
  lastAttempt   = this.puzzleService.lastAttempt;

  /** Final letter rank for the match summary */
  matchRank = computed(() => {
    const pct = this.maxMatchScore() > 0 ? this.matchScore() / this.maxMatchScore() : 0;
    if (pct >= 0.9) return { label: 'S', color: '#0ac8b9' };
    if (pct >= 0.78) return { label: 'A', color: '#7ec87a' };
    if (pct >= 0.62) return { label: 'B', color: '#c89b3c' };
    if (pct >= 0.45) return { label: 'C', color: '#d08030' };
    return { label: 'D', color: '#e06060' };
  });

  /** Hints currently visible (subtle → obvious, revealed on wrong guesses) */
  visibleHints = computed(() => {
    const p = this.puzzle();
    if (!p) return [];
    return p.hints.slice(0, this.revealedHints());
  });

  searchTerm = signal('');

  private allChampions = toSignal(this.champService.getChampions(), {
    initialValue: [] as Champion[],
  });

  // ── Normalized view: "my team" = the one being completed ──
  myTeam = computed<PuzzlePick[]>(() => {
    const p = this.puzzle();
    if (!p) return [];
    const picks = p.missingTeam === 'ally' ? p.allyPicks : p.enemyPicks;
    return this.fillRoles(picks, p.missingRole);
  });

  oppTeam = computed<PuzzlePick[]>(() => {
    const p = this.puzzle();
    if (!p) return [];
    const picks = p.missingTeam === 'ally' ? p.enemyPicks : p.allyPicks;
    return this.fillRoles(picks, null);
  });

  myBans = computed<PuzzleChampion[]>(() => {
    const p = this.puzzle();
    if (!p) return [];
    return p.missingTeam === 'ally' ? p.allyBans : p.enemyBans;
  });

  oppBans = computed<PuzzleChampion[]>(() => {
    const p = this.puzzle();
    if (!p) return [];
    return p.missingTeam === 'ally' ? p.enemyBans : p.allyBans;
  });

  /** Champions already used in the draft (can't be picked) */
  private usedIds = computed(() => {
    const p = this.puzzle();
    if (!p) return new Set<string>();
    const all = [
      ...p.allyPicks, ...p.enemyPicks,
    ].filter(x => x.champion).map(x => x.champion!.id.toLowerCase());
    const bans = [...p.allyBans, ...p.enemyBans].map(b => b.id.toLowerCase());
    return new Set([...all, ...bans]);
  });

  filteredChampions = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return [];
    const used = this.usedIds();
    const guessed = new Set(this.attempts().map(a => a.champion.id.toLowerCase()));
    return this.allChampions()
      .filter(c => {
        const id = c.id.toLowerCase();
        return !used.has(id) && !guessed.has(id) && c.name.toLowerCase().includes(term);
      })
      .slice(0, 40);
  });

  /** Roles laid out top→support, with the missing role marked null */
  private fillRoles(picks: PuzzlePick[], missingRole: DraftRole | null): PuzzlePick[] {
    const byRole = new Map(picks.filter(p => p.champion).map(p => [p.role, p]));
    return ROLES.map(role => {
      if (role === missingRole) return { role, champion: null };
      return byRole.get(role) ?? { role, champion: null };
    });
  }

  setDifficulty(d: PuzzleDifficulty) {
    if (this.phase() === 'idle') this.difficulty.set(d);
  }

  toggleHints() {
    if (this.phase() === 'idle') this.hintsEnabled.update((v) => !v);
  }

  startMatch() {
    this.searchTerm.set('');
    this.puzzleService.startMatch();
  }

  next() {
    this.searchTerm.set('');
    this.puzzleService.nextRound();
  }

  retryRound() {
    this.puzzleService.retryRound();
  }

  quit() {
    this.puzzleService.quitToMenu();
  }

  pick(c: Champion) {
    this.searchTerm.set('');
    this.puzzleService.submitPick({ id: c.id, name: c.name });
  }

  giveUp() {
    this.puzzleService.giveUp();
  }

  champIcon(id: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}/img/champion/${id}.png`;
  }

  gradeColor(grade: PickGrade): string {
    return GRADE_META[grade].color;
  }

  /** Dynamic translation lookup (for `puzzleDiff_*` / `puzzleGrade_*` keys) */
  tt(key: string): string {
    return (this.ls.T() as Record<string, string>)[key] ?? key;
  }

  /** Did the player pick the same champion as a given answer? */
  isPlayerPick(championId: string): boolean {
    return this.result()?.champion.id.toLowerCase() === championId.toLowerCase();
  }
}
