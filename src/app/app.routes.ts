import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'draft',
    pathMatch: 'full',
  },
  {
    path: 'draft',
    loadComponent: () =>
      import('./features/draft/pages/draft-page/draft-page.component').then(
        (m) => m.DraftPageComponent,
      ),
  },
  {
    path: 'pool',
    loadComponent: () =>
      import('./features/champion-pool/pages/champion-pool-page/champion-pool-page.component').then(
        (m) => m.ChampionPoolPageComponent,
      ),
  },
];
