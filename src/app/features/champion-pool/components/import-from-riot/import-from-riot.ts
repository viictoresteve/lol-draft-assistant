import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { catchError, forkJoin, of } from 'rxjs';

import { ChampionsService } from '@core/services/champions.service';
import { LanguageService } from '@core/services/language.service';
import { PlayerProfileService } from '@core/services/player-profile.service';
import {
  PlayerProfile,
  ProfileChampion,
  RankInfo,
  RiotLookupError,
  RiotService,
  RIOT_REGIONS,
} from '@core/services/riot.service';
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

/** A remembered Riot ID lookup, shown as a clickable chip. */
interface SearchEntry {
  gameName: string;
  tagLine: string;
  region: string;
}

const HISTORY_KEY = 'lol-riot-search-history';
const HISTORY_MAX = 6;

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
  private playerProfile = inject(PlayerProfileService);

  readonly regions = RIOT_REGIONS;

  riotId = signal('');
  region = signal('euw1');
  loading = signal(false);
  error = signal<RiotLookupError | null>(null);
  results = signal<ImportResult[]>([]);
  excluded = signal<Set<string>>(new Set());
  addedCount = signal<number | null>(null);
  profile = signal<PlayerProfile | null>(null);
  history = signal<SearchEntry[]>(this.loadHistory());

  selectedCount = computed(
    () => this.results().filter((r) => !this.excluded().has(r.champion.id)).length,
  );

  // Fast lookup of a champion's recent win rate, keyed by numeric DDragon id.
  private profileByChampId = computed(
    () => new Map((this.profile()?.champions ?? []).map((c) => [c.championId, c])),
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
    this.profile.set(null);

    // Rank + real role split + per-champ win rate load in parallel (heavier,
    // match-history based) and enrich the card/mains as soon as they arrive —
    // a profile failure never blocks the fast mastery-based mains grid.
    this.riot.getProfile(gameName, tagLine, this.region()).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.playerProfile.set(p); // share app-wide so the draft AI can personalise
      },
      error: () => this.profile.set(null),
    });

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
        this.pushHistory({ gameName, tagLine, region: this.region() });
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
    this.profile.set(null);
  }

  // ── Search history ──────────────────────────────────────────────────────────

  /** Re-run a remembered lookup with one click. */
  useHistory(entry: SearchEntry) {
    this.riotId.set(`${entry.gameName}#${entry.tagLine}`);
    this.region.set(entry.region);
    this.onImport();
  }

  removeHistory(entry: SearchEntry, event: Event) {
    event.stopPropagation();
    this.saveHistory(this.history().filter((e) => this.entryKey(e) !== this.entryKey(entry)));
  }

  private pushHistory(entry: SearchEntry) {
    const deduped = [entry, ...this.history().filter((e) => this.entryKey(e) !== this.entryKey(entry))];
    this.saveHistory(deduped.slice(0, HISTORY_MAX));
  }

  private entryKey(e: SearchEntry): string {
    return `${e.gameName.toLowerCase()}#${e.tagLine.toLowerCase()}#${e.region}`;
  }

  private loadHistory(): SearchEntry[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as SearchEntry[]) : [];
    } catch {
      return [];
    }
  }

  private saveHistory(list: SearchEntry[]) {
    this.history.set(list);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable — chips still work for this session */
    }
  }

  /** "1,234,567" → "1.2M", "45,000" → "45K" */
  formatPoints(points: number): string {
    if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`;
    if (points >= 1_000) return `${Math.round(points / 1_000)}K`;
    return String(points);
  }

  /** Recent win-rate record for a pool champion, or undefined if not played. */
  wrFor(champion: Champion): ProfileChampion | undefined {
    return champion.key ? this.profileByChampId().get(Number(champion.key)) : undefined;
  }

  /** "Platinum II · 47 LP" for one queue's rank badge. */
  tierLabel(rank: RankInfo): string {
    const tier = rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase();
    return `${tier} ${rank.division} · ${rank.lp} LP`;
  }

  /** Role split as [{ role, pct }] over the analysed games (desc). */
  roleSplit(): { role: string; pct: number }[] {
    const roles = this.profile()?.roles ?? [];
    const total = roles.reduce((sum, r) => sum + r.games, 0);
    if (!total) return [];
    return roles.map((r) => ({ role: r.role, pct: Math.round((r.games / total) * 100) }));
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
