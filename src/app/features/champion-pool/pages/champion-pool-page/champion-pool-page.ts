import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { PoolSelector } from '@features/champion-pool/components/pool-selector/pool-selector';
import { PoolDisplay } from '@features/champion-pool/components/pool-display/pool-display';
import { LanguageService } from '@core/services/language.service';

@Component({
  selector: 'app-champion-pool-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PoolSelector, PoolDisplay],
  templateUrl: './champion-pool-page.html',
  styleUrl: './champion-pool-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChampionPoolPage {
  ls = inject(LanguageService);
}
