import { Component, Output, EventEmitter, inject, OnInit, Input } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, combineLatest, startWith } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Champion } from '@shared/models/champion.interface';
import { ChampionCard } from '../champion-card/champion-card';
import { ChampionsService } from '@core/services/champions.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-champion-search',
  imports: [AsyncPipe, ReactiveFormsModule, ChampionCard, TranslateModule],
  templateUrl: './champion-search.html',
  styleUrl: './champion-search.scss',
})
export class ChampionSearch implements OnInit {
  @Output() championSelected = new EventEmitter<Champion>();
  @Output() addToPool = new EventEmitter<Champion>();
  @Input() usedChampionIds: Set<string> | null = null;

  private championsService = inject(ChampionsService);

  searchControl = new FormControl('');

  filteredChampions$!: Observable<Champion[]>;

  ngOnInit() {
    this.filteredChampions$ = combineLatest([
      this.championsService.getChampions(),
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
      ),
    ]).pipe(
      map(([champions, searchTerm]) =>
        champions.filter((c) => c.name.toLowerCase().includes((searchTerm ?? '').toLowerCase())),
      ),
    );
  }

  onChampionClick(champion: Champion) {
    this.championSelected.emit(champion);
  }
  onChampionRightClick(champion: Champion, event: MouseEvent) {
    event.preventDefault();
    this.addToPool.emit(champion);
  }
  isUsed(championId: string): boolean {
    return this.usedChampionIds?.has(championId) ?? false;
  }
}
