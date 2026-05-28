import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Champion } from '@shared/models/champion.interface';

@Component({
  selector: 'app-champion-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './champion-card.html',
  styleUrl: './champion-card.scss',
})
export class ChampionCard {
  champion = input.required<Champion>();
  showName = input(true);
}
