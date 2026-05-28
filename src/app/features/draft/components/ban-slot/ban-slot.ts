import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Champion } from '@shared/models/champion.interface';

@Component({
  selector: 'app-ban-slot',
  imports: [TranslateModule],
  templateUrl: './ban-slot.html',
  styleUrl: './ban-slot.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanSlot {
  @Input() champion: Champion | null = null;
  @Input() isAlly = true;
  @Output() banRemoved = new EventEmitter<void>();
}
