import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { DraftPick } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';

@Component({
  selector: 'app-pick-slot',
  imports: [],
  templateUrl: './pick-slot.html',
  styleUrl: './pick-slot.scss',
  host: {
    style: 'aspect-ratio: 1; display: block;',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickSlot {
  @Input({ required: true }) pick!: DraftPick;
  @Input() isAlly = true;
  @Output() championRemoved = new EventEmitter<void>();
}
