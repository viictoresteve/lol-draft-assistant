import { Component, ChangeDetectionStrategy, input, signal, inject, effect } from '@angular/core';
import { Store } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';
import * as DraftActions from '@store/draft/draft.actions';
import { ChampionSearch } from '@shared/components/champion-search/champion-search';

@Component({
  selector: 'app-ban-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChampionSearch],
  templateUrl: './ban-panel.html',
  styleUrl: './ban-panel.scss',
})
export class BanPanel {
  private store = inject(Store);

  team = input.required<'ally' | 'enemy'>();
  bans = input.required<Champion[]>();
  excludeIds = input<string[]>([]);

  isSearchOpen = signal(false);

  banSlots = Array.from({ length: 5 });

  constructor() {
    // Auto-close when all 5 bans are filled
    effect(() => {
      if (this.bans().length >= 5) {
        this.isSearchOpen.set(false);
      }
    });
  }

  openSearch() {
    if (this.bans().length < 5) {
      this.isSearchOpen.set(true);
    }
  }

  onChampionSelected(champion: Champion) {
    if (this.team() === 'ally') {
      this.store.dispatch(DraftActions.addAllyBan({ champion }));
    } else {
      this.store.dispatch(DraftActions.addEnemyBan({ champion }));
    }
    // keepOpen=true handles staying open; effect auto-closes at 5
  }

  closeSearch() {
    this.isSearchOpen.set(false);
  }

  removeBan(champion: Champion) {
    if (this.team() === 'ally') {
      this.store.dispatch(DraftActions.removeAllyBan({ championId: champion.id }));
    } else {
      this.store.dispatch(DraftActions.removeEnemyBan({ championId: champion.id }));
    }
  }

  searchExcludeIds() {
    return [...this.excludeIds(), ...this.bans().map((c) => c.id)];
  }
}
