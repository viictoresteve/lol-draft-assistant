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
      import('./features/draft/pages/draft-page/draft-page').then((m) => m.DraftPage),
  },
  {
    path: 'pool',
    loadComponent: () =>
      import('./features/champion-pool/pages/champion-pool-page/champion-pool-page').then(
        (m) => m.ChampionPoolPage,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/pages/settings-page/settings-page').then(
        (m) => m.SettingsPage,
      ),
  },
];
