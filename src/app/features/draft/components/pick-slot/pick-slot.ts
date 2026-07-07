import { Component, ChangeDetectionStrategy, input, signal, inject, computed } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, distinctUntilChanged } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { DraftPick, DraftRole } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';
import { ChampionsService } from '@core/services/champions.service';
import { TierListService } from '@core/services/tier-list.service';
import { PatchService } from '@core/services/patch.service';
import * as DraftActions from '@store/draft/draft.actions';

@Component({
  selector: 'app-pick-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './pick-slot.html',
  styleUrl: './pick-slot.scss',
  host: { style: 'display: block;' },
})
export class PickSlot {
  private store = inject(Store);
  private champService = inject(ChampionsService);
  private tierListService = inject(TierListService);
  private patchService = inject(PatchService);

  pick = input.required<DraftPick>();
  team = input.required<'ally' | 'enemy'>();
  excludeIds = input<string[]>([]);
  myRole = input<DraftRole | null>(null);

  isMyRole() { return this.myRole() === this.pick().role; }

  isSearchOpen = signal(false);
  searchTerm = signal('');

  private allChampions = toSignal(this.champService.getChampions(), {
    initialValue: [] as Champion[],
  });

  private tierData = toSignal(
    toObservable(this.pick).pipe(
      distinctUntilChanged((a, b) => a.role === b.role),
      switchMap((p) => this.tierListService.getChampionTiers(p.role)),
    ),
    { initialValue: null },
  );

  // Top picks for this role from OP.GG — shown when search is empty
  defaultChampions = computed(() => {
    const excluded = new Set(this.excludeIds());
    const tier = this.tierData();
    if (tier && tier.length > 0) {
      return tier
        .filter((e) => !excluded.has(e.name.replace(/['\s]/g, '')))
        .slice(0, 12)
        .map((e) => {
          const id = e.name.replace(/['\s`]/g, '');
          return this.allChampions().find((c) => c.id === id) ?? null;
        })
        .filter((c): c is Champion => c !== null);
    }
    // Fallback: first 12 champions alphabetically
    return this.allChampions().filter((c) => !excluded.has(c.id)).slice(0, 12);
  });

  filteredChampions = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return [];
    const excluded = new Set(this.excludeIds());
    return this.allChampions()
      .filter((c) => !excluded.has(c.id) && c.name.toLowerCase().includes(term))
      .slice(0, 60);
  });

  openSearch() {
    if (!this.pick().champion) {
      this.searchTerm.set('');
      this.isSearchOpen.set(true);
    }
  }

  closeSearch() {
    this.isSearchOpen.set(false);
    this.searchTerm.set('');
  }

  onChampionSelected(champion: Champion) {
    const role = this.pick().role;
    if (this.team() === 'ally') {
      this.store.dispatch(DraftActions.addAllyPick({ champion, role }));
    } else {
      this.store.dispatch(DraftActions.addEnemyPick({ champion, role }));
    }
    this.closeSearch();
  }

  /** Fast id → numeric-key lookup, built once from the full champion roster. */
  private keyById = computed(() => {
    const m = new Map<string, string>();
    for (const c of this.allChampions()) if (c.key) m.set(c.id, c.key);
    return m;
  });

  /**
   * High-res, face-centered champion art for the slot.
   * Community Dragon's "centered" splash (~1920px) is sharp at any slot size and
   * always framed on the champion — fixing both the pixelation of the 120px
   * square icon and the inconsistent cropping of the loading splash.
   * Falls back to the square icon if the numeric key isn't known yet.
   */
  champArt(championId: string): string {
    const key = this.pick().champion?.key ?? this.keyById().get(championId);
    if (key) {
      return `https://cdn.communitydragon.org/latest/champion/${key}/splash-art/centered`;
    }
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}/img/champion/${championId}.png`;
  }

  removePick(event: Event) {
    event.stopPropagation();
    const role = this.pick().role;
    if (this.team() === 'ally') {
      this.store.dispatch(DraftActions.removeAllyPick({ role }));
    } else {
      this.store.dispatch(DraftActions.removeEnemyPick({ role }));
    }
  }
}
