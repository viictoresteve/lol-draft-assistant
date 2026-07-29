import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { PoolSelector } from '@features/champion-pool/components/pool-selector/pool-selector';
import { PoolDisplay } from '@features/champion-pool/components/pool-display/pool-display';
import { ImportFromRiot } from '@features/champion-pool/components/import-from-riot/import-from-riot';
import { LanguageService } from '@core/services/language.service';
import { DraftRole } from '@features/draft/models/draft.interface';
import * as PoolActions from '@store/pool/pool.actions';
import { selectPoolChampionIds } from '@store/pool/pool.selectors';
import { toSignal } from '@angular/core/rxjs-interop';

const ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

@Component({
  selector: 'app-champion-pool-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PoolSelector, PoolDisplay, ImportFromRiot],
  templateUrl: './champion-pool-page.html',
  styleUrl: './champion-pool-page.scss',
})
export class ChampionPoolPage {
  ls = inject(LanguageService);
  private store = inject(Store);
  readonly roles = ROLES;
  activeRole = signal<DraftRole>('top');

  /** All pooled champion ids across roles — used to disable "clear" when empty. */
  private poolIds = toSignal(this.store.select(selectPoolChampionIds), { initialValue: [] as string[] });
  poolCount = () => this.poolIds().length;
  confirmingClear = signal(false);

  setRole(role: DraftRole) {
    this.activeRole.set(role);
  }

  /** Two-step confirm so a whole pool isn't wiped by a single misclick. */
  clearPool() {
    if (!this.confirmingClear()) {
      this.confirmingClear.set(true);
      return;
    }
    this.store.dispatch(PoolActions.clearPool());
    this.confirmingClear.set(false);
  }

  cancelClear() {
    this.confirmingClear.set(false);
  }
}
