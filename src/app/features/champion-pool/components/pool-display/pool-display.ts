import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { selectPoolChampions } from '@store/pool/pool.selectors';
import * as PoolActions from '@store/pool/pool.actions';
import { Champion } from '@shared/models/champion.interface';
import { LanguageService } from '@core/services/language.service';

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

  champions = toSignal(this.store.select(selectPoolChampions), { initialValue: [] as Champion[] });

  remove(championId: string) {
    this.store.dispatch(PoolActions.removeFromPool({ championId }));
  }
}
