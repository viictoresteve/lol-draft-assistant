import {
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import * as Sentry from '@sentry/angular';
import { routes } from './app.routes';
import { draftReducer } from '@store/draft/draft.reducer';
import { poolReducer } from '@store/pool/pool.reducer';
import { DraftEffects } from '@store/draft/draft.effects';
import { PoolEffects } from '@store/pool/pool.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([])),
    provideStore({
      draft: draftReducer,
      pool: poolReducer,
    }),
    provideEffects([DraftEffects, PoolEffects]),
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler({ showDialog: false }) },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
