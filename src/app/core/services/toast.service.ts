import { Injectable, signal } from '@angular/core';

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

/**
 * Lightweight transient notifications (toasts). Any service/component can call
 * `toast.error(...)` etc. to surface a failure to the user instead of leaving
 * it in the console. Rendered by <app-toast> mounted once at the app root.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private nextId = 0;

  show(message: string, type: ToastType = 'info', durationMs = 5000): number {
    const id = ++this.nextId;
    this._toasts.update((list) => {
      // Collapse duplicate consecutive messages (e.g. repeated AI errors).
      if (list.some((t) => t.message === message && t.type === type)) return list;
      return [...list, { id, type, message }];
    });
    if (durationMs > 0) setTimeout(() => this.dismiss(id), durationMs);
    return id;
  }

  error(message: string)   { return this.show(message, 'error', 7000); }
  warning(message: string) { return this.show(message, 'warning', 6000); }
  success(message: string) { return this.show(message, 'success', 4000); }
  info(message: string)    { return this.show(message, 'info', 5000); }

  dismiss(id: number) {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
