import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { OnboardingComponent } from '@features/onboarding/onboarding.component';
import { Store } from '@ngrx/store';
import { LanguageService } from '@core/services/language.service';
import { Lang } from '@core/i18n/translations';
import { PatchService } from '@core/services/patch.service';
import { SettingsService } from '@core/services/settings.service';
import * as PoolActions from '@store/pool/pool.actions';
import * as DraftActions from '@store/draft/draft.actions';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, OnboardingComponent],
  templateUrl: './app.html',
  styleUrl: './app.component.scss',
})
export class App implements OnInit {
  private store = inject(Store);
  ls = inject(LanguageService);
  patchService = inject(PatchService);
  settingsService = inject(SettingsService);

  get hasApiKey() { return !!this.settingsService.apiKey(); }

  get patchVersion() { return this.patchService.version(); }

  ngOnInit() {
    this.store.dispatch(PoolActions.loadPool());
    this.store.dispatch(DraftActions.loadDraft());
  }

  setLang(lang: Lang) {
    this.ls.setLang(lang);
    // Re-trigger all AI analysis in the new language
    // Each effect has its own filters (role required, picks required, etc.)
    // so no unnecessary calls are made
    this.store.dispatch(DraftActions.retryAnalysis());
  }
}
