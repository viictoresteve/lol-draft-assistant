import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { selectByRole } from '@store/pool/pool.selectors';
import * as PoolActions from '@store/pool/pool.actions';
import { Champion } from '@shared/models/champion.interface';
import { LanguageService } from '@core/services/language.service';
import { DraftRole } from '@features/draft/models/draft.interface';

const ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

@Component({
  selector: 'app-pool-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './pool-display.html',
  styleUrl: './pool-display.scss',
})
export class PoolDisplay {
  private store = inject(Store);
  ls = inject(LanguageService);

  activeRole = input.required<DraftRole>();

  readonly roles = ROLES;

  byRole = toSignal(this.store.select(selectByRole), {
    initialValue: { top: [], jungle: [], mid: [], adc: [], support: [] } as Record<DraftRole, Champion[]>,
  });

  remove(championId: string, role: DraftRole) {
    this.store.dispatch(PoolActions.removeFromPool({ championId, role }));
  }
}
