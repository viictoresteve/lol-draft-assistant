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
    path: 'puzzle',
    loadComponent: () =>
      import('./features/puzzle/pages/puzzle-page/puzzle-page').then((m) => m.PuzzlePage),
  },
  {
    path: 'abilities',
    loadComponent: () =>
      import('./features/ability-quiz/pages/ability-quiz-page/ability-quiz-page').then(
        (m) => m.AbilityQuizPage,
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
