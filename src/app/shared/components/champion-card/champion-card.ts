import { Component, Input } from '@angular/core';
import { Champion } from '@shared/models/champion.interface';

@Component({
  selector: 'app-champion-card',
  imports: [],
  templateUrl: './champion-card.html',
  styleUrl: './champion-card.scss',
})
export class ChampionCard {
  @Input({ required: true }) champion!: Champion;
  @Input() isSelected = false;
  @Input() isInPool = false;
}
