import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { catchError, forkJoin, of } from 'rxjs';

import { ChampionsService } from '@core/services/champions.service';
import { LanguageService } from '@core/services/language.service';
import { RiotLookupError, RiotService, RIOT_REGIONS } from '@core/services/riot.service';
import { ChampionTierEntry, TierListService } from '@core/services/tier-list.service';
import { DraftRole } from '@features/draft/models/draft.interface';
import { ImgFallbackDirective } from '@shared/directives/img-fallback.directive';
import { Champion } from '@shared/models/champion.interface';
import * as PoolActions from '@store/pool/pool.actions';

const ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

interface ImportResult {
  champion: Champion;
  role: DraftRole;
  points: number;
}

/**
 * Enter a Riot ID → fetch the player's most-played champions (mastery) and
 * offer to add them to the pool. Each champion's role is detected from the
 * OP.GG tier lists (the role it's most-picked in), falling back to its class
 * tags if tier data is unavailable. The user can deselect any before adding.
 */
@Component({
  selector: 'app-import-from-riot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ImgFallbackDirective],
  templateUrl: './import-from-riot.html',
  styleUrl: './import-from-riot.scss',
})
export class ImportFromRiot {
  ls = inject(LanguageService);
  private riot = inject(RiotService);
  private champService = inject(ChampionsService);
  private tierList = inject(TierListService);
  private store = inject(Store);

  readonly regions = RIOT_REGIONS;

  riotId = signal('');
  region = signal('euw1');
  loading = signal(false);
  error = signal<RiotLookupError | null>(null);
  results = signal<ImportResult[]>([]);
  excluded = signal<Set<string>>(new Set());
  addedCount = signal<number | null>(null);

  selectedCount = computed(
    () => this.results().filter((r) => !this.excluded().has(r.champion.id)).length,
  );

  onImport() {
    const raw = this.riotId().trim();
    const hash = raw.lastIndexOf('#');
    const gameName = hash > 0 ? raw.slice(0, hash).trim() : '';
    const tagLine = hash > 0 ? raw.slice(hash + 1).trim() : '';
    if (!gameName || !tagLine) {
      this.error.set({ code: 'BAD_INPUT', message: 'Invalid Riot ID' });
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.results.set([]);
    this.excluded.set(new Set());
    this.addedCount.set(null);

    forkJoin({
      top: this.riot.getTopChampions(gameName, tagLine, this.region()),
      champs: this.champService.getChampions(),
      tiers: forkJoin(
        ROLES.map((r) => this.tierList.getChampionTiers(r).pipe(catchError(() => of(null)))),
      ),
    }).subscribe({
      next: ({ top, champs, tiers }) => {
        const byKey = new Map(champs.filter((c) => c.key).map((c) => [Number(c.key), c]));
        const roleByName = this.buildRoleMap(tiers);
        const results = top
          .map((t): ImportResult | null => {
            const champion = byKey.get(t.championId);
            if (!champion) return null;
            const role = roleByName.get(this.norm(champion.name)) ?? this.tagRole(champion);
            return { champion, role, points: t.championPoints };
          })
          .filter((r): r is ImportResult => r !== null);

        this.results.set(results);
        this.loading.set(false);
        if (results.length === 0) this.error.set({ code: 'NOT_FOUND', message: 'No champions' });
      },
      error: (e: RiotLookupError) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }

  toggle(championId: string) {
    this.excluded.update((set) => {
      const next = new Set(set);
      if (next.has(championId)) next.delete(championId);
      else next.add(championId);
      return next;
    });
  }

  isIncluded(championId: string): boolean {
    return !this.excluded().has(championId);
  }

  addSelected() {
    const selected = this.results().filter((r) => !this.excluded().has(r.champion.id));
    for (const r of selected) {
      this.store.dispatch(PoolActions.addToPool({ champion: r.champion, role: r.role }));
    }
    this.addedCount.set(selected.length);
    this.results.set([]);
  }

  clear() {
    this.results.set([]);
    this.error.set(null);
    this.addedCount.set(null);
  }

  /** "1,234,567" → "1.2M", "45,000" → "45K" */
  formatPoints(points: number): string {
    if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`;
    if (points >= 1_000) return `${Math.round(points / 1_000)}K`;
    return String(points);
  }

  /** Localised message for the current error code. */
  errorText(): string {
    const t = this.ls.T();
    switch (this.error()?.code) {
      case 'NO_KEY': return t.riotErrNoKey;
      case 'NOT_FOUND': return t.riotErrNotFound;
      case 'RATE': return t.riotErrRate;
      case 'BAD_KEY': return t.riotErrBadKey;
      case 'BAD_INPUT': return t.riotIdInvalid;
      default: return t.riotErrGeneric;
    }
  }

  // ── Role detection ─────────────────────────────────────────────────────────

  /** Map champion name → the role it's most-picked in (highest pick rate). */
  private buildRoleMap(tierLists: (ChampionTierEntry[] | null)[]): Map<string, DraftRole> {
    const best = new Map<string, { role: DraftRole; pickRate: number }>();
    ROLES.forEach((role, i) => {
      for (const entry of tierLists[i] ?? []) {
        const nameKey = this.norm(entry.name);
        const pickRate = entry.pickRate ?? 0;
        const current = best.get(nameKey);
        if (!current || pickRate > current.pickRate) best.set(nameKey, { role, pickRate });
      }
    });
    return new Map([...best].map(([name, v]) => [name, v.role]));
  }

  /** Rough role from Riot class tags — only used when tier data is missing. */
  private tagRole(c: Champion): DraftRole {
    if (c.tags.includes('Marksman')) return 'adc';
    if (c.tags.includes('Support')) return 'support';
    if (c.tags.includes('Assassin') || c.tags.includes('Mage')) return 'mid';
    return 'top';
  }

  private norm(s: string): string {
    return s.toLowerCase().replace(/['\s.]/g, '');
  }
}
