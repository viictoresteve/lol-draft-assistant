import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { routes } from './app.routes';
import { DraftEffects } from '@store/draft/draft.effects';
import { draftReducer } from '@store/draft/draft.reducer';
import { PoolEffects } from '@store/pool/pool.effects';
import { poolReducer } from '@store/pool/pool.reducer';

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
  ],
};
