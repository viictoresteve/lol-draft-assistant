import { Component, ChangeDetectionStrategy, input, signal, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DraftPick, DraftRole } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';
import * as DraftActions from '@store/draft/draft.actions';
import { ChampionSearch } from '@shared/components/champion-search/champion-search';

@Component({
  selector: 'app-pick-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChampionSearch],
  templateUrl: './pick-slot.html',
  styleUrl: './pick-slot.scss',
})
export class PickSlot {
  private store = inject(Store);

  pick = input.required<DraftPick>();
  team = input.required<'ally' | 'enemy'>();
  excludeIds = input<string[]>([]);
  myRole = input<DraftRole | null>(null);

  isMyRole() {
    return this.myRole() === this.pick().role;
  }

  isSearchOpen = signal(false);

  openSearch() {
    if (!this.pick().champion) {
      this.isSearchOpen.set(true);
    }
  }

  closeSearch() {
    this.isSearchOpen.set(false);
  }

  onChampionSelected(champion: Champion) {
    const role = this.pick().role;
    if (this.team() === 'ally') {
      this.store.dispatch(DraftActions.addAllyPick({ champion, role }));
    } else {
      this.store.dispatch(DraftActions.addEnemyPick({ champion, role }));
    }
    this.isSearchOpen.set(false);
  }

  getLoadingArt(championId: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championId}_0.jpg`;
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
