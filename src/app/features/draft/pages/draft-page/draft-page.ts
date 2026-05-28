import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import {
  selectAllyPicks,
  selectEnemyPicks,
  selectAllyBans,
  selectEnemyBans,
  selectUserRole,
  selectSide,
} from '@store/draft/draft.selectors';
import * as DraftActions from '@store/draft/draft.actions';
import { PickSlot } from '@features/draft/components/pick-slot/pick-slot';
import { BanPanel } from '@features/draft/components/ban-panel/ban-panel';
import { SuggestionsPanel } from '@features/draft/components/suggestions-panel/suggestions-panel';
import { DraftPick, DraftRole, DraftSide } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';
import { LanguageService } from '@core/services/language.service';

const ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

@Component({
  selector: 'app-draft-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PickSlot, BanPanel, SuggestionsPanel],
  templateUrl: './draft-page.html',
  styleUrl: './draft-page.scss',
})
export class DraftPage {
  private store = inject(Store);
  ls = inject(LanguageService);

  readonly roles = ROLES;

  allyPicks = toSignal(this.store.select(selectAllyPicks), { initialValue: [] as DraftPick[] });
  enemyPicks = toSignal(this.store.select(selectEnemyPicks), { initialValue: [] as DraftPick[] });
  allyBans = toSignal(this.store.select(selectAllyBans), { initialValue: [] as Champion[] });
  enemyBans = toSignal(this.store.select(selectEnemyBans), { initialValue: [] as Champion[] });
  userRole = toSignal(this.store.select(selectUserRole), { initialValue: null as DraftRole | null });
  side = toSignal(this.store.select(selectSide), { initialValue: 'blue' as DraftSide });

  takenIds = computed(() => [
    ...this.allyPicks().filter((p) => p.champion).map((p) => p.champion!.id),
    ...this.enemyPicks().filter((p) => p.champion).map((p) => p.champion!.id),
    ...this.allyBans().map((c) => c.id),
    ...this.enemyBans().map((c) => c.id),
  ]);

  setRole(role: DraftRole) {
    const current = this.userRole();
    this.store.dispatch(DraftActions.setUserRole({ role: current === role ? null : role }));
  }

  setSide(side: DraftSide) {
    this.store.dispatch(DraftActions.setSide({ side }));
  }

  reset() {
    this.store.dispatch(DraftActions.resetDraft());
  }
}
