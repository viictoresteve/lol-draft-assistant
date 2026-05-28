import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { combineLatest, map } from 'rxjs';
import { ChampionSearch } from '@shared/components/champion-search/champion-search';
import { PickSlot } from '@features/draft/components/pick-slot/pick-slot';
import { BanSlot } from '@features/draft/components/ban-slot/ban-slot';
import { SuggestionsPanel } from '@features/draft/components/suggestions-panel/suggestions-panel';
import {
  selectAllyPicks,
  selectEnemyPicks,
  selectAllyBans,
  selectEnemyBans,
} from '@store/draft/draft.selectors';
import { selectPoolChampionIds } from '@store/pool/pool.selectors';
import * as DraftActions from '@store/draft/draft.actions';
import * as PoolActions from '@store/pool/pool.actions';
import { Champion } from '@shared/models/champion.interface';
import { DraftRole } from '@features/draft/models/draft.interface';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-draft-page',
  imports: [AsyncPipe, ChampionSearch, PickSlot, BanSlot, SuggestionsPanel, TranslateModule],
  templateUrl: './draft-page.html',
  styleUrl: './draft-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftPage implements OnInit {
  private store = inject(Store);

  allyPicks$ = this.store.select(selectAllyPicks);
  enemyPicks$ = this.store.select(selectEnemyPicks);
  allyBans$ = this.store.select(selectAllyBans);
  enemyBans$ = this.store.select(selectEnemyBans);
  poolChampionIds$ = this.store.select(selectPoolChampionIds);

  usedChampionIds$ = combineLatest([
    this.store.select(selectAllyPicks),
    this.store.select(selectEnemyPicks),
    this.store.select(selectAllyBans),
    this.store.select(selectEnemyBans),
  ]).pipe(
    map(([allyPicks, enemyPicks, allyBans, enemyBans]) => {
      const pickIds = [
        ...allyPicks.filter((p) => p.champion).map((p) => p.champion!.id),
        ...enemyPicks.filter((p) => p.champion).map((p) => p.champion!.id),
      ];
      const banIds = [...allyBans.map((b) => b.id), ...enemyBans.map((b) => b.id)];
      return new Set([...pickIds, ...banIds]);
    }),
  );

  readonly roles: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  selectedRole: DraftRole = 'top';
  myRole: DraftRole | null = null;
  isAllyTurn = true;
  isBanning = false;
  banningFor: 'ally' | 'enemy' = 'ally';

  ngOnInit() {
    this.store.dispatch(PoolActions.loadPool());
  }

  onChampionSelected(champion: Champion) {
    if (this.isBanning) {
      if (this.banningFor === 'ally') {
        this.store.dispatch(DraftActions.addAllyBan({ champion }));
      } else {
        this.store.dispatch(DraftActions.addEnemyBan({ champion }));
      }
      this.isBanning = false;
    } else {
      if (this.isAllyTurn) {
        this.store.dispatch(DraftActions.addAllyPick({ champion, role: this.selectedRole }));
      } else {
        this.store.dispatch(DraftActions.addEnemyPick({ champion, role: this.selectedRole }));
      }
    }
  }

  startBanning(side: 'ally' | 'enemy') {
    this.isBanning = true;
    this.banningFor = side;
  }

  onRoleSelected(role: DraftRole) {
    this.selectedRole = role;
  }

  onMyRoleSelected(role: DraftRole) {
    this.myRole = role;
  }

  onAllyPickRemoved(role: DraftRole) {
    this.store.dispatch(DraftActions.removeAllyPick({ role }));
  }

  onEnemyPickRemoved(role: DraftRole) {
    this.store.dispatch(DraftActions.removeEnemyPick({ role }));
  }

  onResetDraft() {
    this.store.dispatch(DraftActions.resetDraft());
  }

  toggleTurn() {
    this.isAllyTurn = !this.isAllyTurn;
  }

  onAddToPool(champion: Champion) {
    this.store.dispatch(PoolActions.addToPool({ champion }));
    this.store.dispatch(PoolActions.savePool());
  }
}
