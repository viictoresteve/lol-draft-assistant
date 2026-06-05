import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { PoolSelector } from '@features/champion-pool/components/pool-selector/pool-selector';
import { PoolDisplay } from '@features/champion-pool/components/pool-display/pool-display';
import { LanguageService } from '@core/services/language.service';
import { DraftRole } from '@features/draft/models/draft.interface';

const ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

@Component({
  selector: 'app-champion-pool-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PoolSelector, PoolDisplay],
  templateUrl: './champion-pool-page.html',
  styleUrl: './champion-pool-page.scss',
})
export class ChampionPoolPage {
  ls = inject(LanguageService);
  readonly roles = ROLES;
  activeRole = signal<DraftRole>('top');

  setRole(role: DraftRole) {
    this.activeRole.set(role);
  }
}
