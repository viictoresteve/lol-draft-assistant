import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { ChampionSearch } from '@shared/components/champion-search/champion-search';
import { ChampionCard } from '@shared/components/champion-card/champion-card';
import { selectPoolChampions } from '@store/pool/pool.selectors';
import * as PoolActions from '@store/pool/pool.actions';
import { Champion } from '@shared/models/champion.interface';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-champion-pool-page',
  imports: [AsyncPipe, ChampionSearch, ChampionCard, TranslateModule, RouterLink],
  templateUrl: './champion-pool-page.html',
  styleUrl: './champion-pool-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChampionPoolPage implements OnInit {
  private store = inject(Store);

  poolChampions$ = this.store.select(selectPoolChampions);

  ngOnInit() {
    this.store.dispatch(PoolActions.loadPool());
  }

  onChampionSelected(champion: Champion) {
    this.store.dispatch(PoolActions.addToPool({ champion }));
    this.store.dispatch(PoolActions.savePool());
  }

  onRemoveFromPool(championId: string) {
    this.store.dispatch(PoolActions.removeFromPool({ championId }));
    this.store.dispatch(PoolActions.savePool());
  }
}
