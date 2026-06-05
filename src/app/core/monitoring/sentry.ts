import * as Sentry from '@sentry/angular';
import { isDevMode } from '@angular/core';
import { environment } from 'src/environments/environment';

export function initSentry() {
  if (isDevMode()) return; // Only in production
  Sentry.init({
    dsn: environment.sentryDsn ?? '',
    environment: 'production',
    tracesSampleRate: 0.1,
    ignoreErrors: ['ResizeObserver loop', 'Non-Error exception captured'],
  });
}
