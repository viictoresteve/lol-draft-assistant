import { Component, ChangeDetectionStrategy, inject, signal, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';
import { ChampionsService } from '@core/services/champions.service';
import { selectByRole } from '@store/pool/pool.selectors';
import * as PoolActions from '@store/pool/pool.actions';
import { LanguageService } from '@core/services/language.service';
import { DraftRole } from '@features/draft/models/draft.interface';

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

  activeRole = input.required<DraftRole>();

  private allChampions = toSignal(this.championsService.getChampions(), {
    initialValue: [] as Champion[],
  });
  private byRole = toSignal(this.store.select(selectByRole), {
    initialValue: { top: [], jungle: [], mid: [], adc: [], support: [] } as Record<DraftRole, Champion[]>,
  });
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

  isInPool(championId: string): boolean {
    return this.byRole()[this.activeRole()].some((c) => c.id === championId);
  }

  toggle(champion: Champion) {
    const role = this.activeRole();
    if (this.isInPool(champion.id)) {
      this.store.dispatch(PoolActions.removeFromPool({ championId: champion.id, role }));
    } else {
      this.store.dispatch(PoolActions.addToPool({ champion, role }));
    }
  }
}
