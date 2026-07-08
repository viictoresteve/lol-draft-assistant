import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService, ToastType } from '@core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  toast = inject(ToastService);

  readonly icons: Record<ToastType, string> = {
    error: '⛔',
    warning: '⚠️',
    success: '✓',
    info: 'ℹ️',
  };
}
