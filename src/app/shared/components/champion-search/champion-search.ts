import { Component, ChangeDetectionStrategy, input, output, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Champion } from '@shared/models/champion.interface';
import { ChampionsService } from '@core/services/champions.service';
import { LanguageService } from '@core/services/language.service';

@Component({
  selector: 'app-champion-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './champion-search.html',
  styleUrl: './champion-search.scss',
})
export class ChampionSearch {
  private championsService = inject(ChampionsService);
  ls = inject(LanguageService);

  excludeIds = input<string[]>([]);
  keepOpen = input(false);
  championSelected = output<Champion>();
  closed = output<void>();

  private allChampions = toSignal(this.championsService.getChampions(), {
    initialValue: [] as Champion[],
  });
  searchTerm = signal('');

  filteredChampions = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const excluded = new Set(this.excludeIds());
    const all = this.allChampions().filter((c) => !excluded.has(c.id));
    if (!term) return all;
    return all.filter((c) => c.name.toLowerCase().includes(term));
  });

  onInput(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  select(champion: Champion) {
    this.championSelected.emit(champion);
    if (!this.keepOpen()) {
      this.closed.emit();
    } else {
      this.searchTerm.set('');
    }
  }

  close() {
    this.closed.emit();
  }

  onPanelKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') this.close();
  }
}
