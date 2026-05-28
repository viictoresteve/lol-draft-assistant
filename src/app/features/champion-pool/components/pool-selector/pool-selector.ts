import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';
import { ChampionsService } from '@core/services/champions.service';
import { selectPoolChampionIds } from '@store/pool/pool.selectors';
import * as PoolActions from '@store/pool/pool.actions';
import { LanguageService } from '@core/services/language.service';

@Component({
  selector: 'app-pool-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './pool-selector.html',
  styleUrl: './pool-selector.scss',
})
export class PoolSelector {
  private store = inject(Store);
  private championsService = inject(ChampionsService);
  ls = inject(LanguageService);

  private allChampions = toSignal(this.championsService.getChampions(), {
    initialValue: [] as Champion[],
  });
  poolIds = toSignal(this.store.select(selectPoolChampionIds), { initialValue: [] as string[] });
  searchTerm = signal('');

  filteredChampions = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return [];
    return this.allChampions()
      .filter((c) => c.name.toLowerCase().includes(term))
      .slice(0, 20);
  });

  onInput(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  toggle(champion: Champion) {
    if (this.poolIds().includes(champion.id)) {
      this.store.dispatch(PoolActions.removeFromPool({ championId: champion.id }));
    } else {
      this.store.dispatch(PoolActions.addToPool({ champion }));
    }
  }

  isInPool(id: string) {
    return this.poolIds().includes(id);
  }
}
