import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { OnboardingComponent } from '@features/onboarding/onboarding.component';
import { ToastComponent } from '@shared/components/toast/toast.component';
import { Store } from '@ngrx/store';
import { LanguageService } from '@core/services/language.service';
import { Lang } from '@core/i18n/translations';
import { PatchService } from '@core/services/patch.service';
import { SettingsService } from '@core/services/settings.service';
import * as PoolActions from '@store/pool/pool.actions';
import * as DraftActions from '@store/draft/draft.actions';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, OnboardingComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.component.scss',
})
export class App implements OnInit {
  private store = inject(Store);
  private swUpdate = inject(SwUpdate);
  ls = inject(LanguageService);
  patchService = inject(PatchService);
  settingsService = inject(SettingsService);

  get hasApiKey() { return this.settingsService.hasAnyKey(); }

  get patchVersion() { return this.patchService.version(); }

  ngOnInit() {
    this.store.dispatch(PoolActions.loadPool());
    this.store.dispatch(DraftActions.loadDraft());
    this.watchForUpdates();
  }

  /**
   * Auto-update the PWA: when a new deploy is detected, activate it and reload.
   * Without this the service worker can serve a stale build, tempting users to
   * "clear site data" to force an update — which also wipes their saved API
   * keys from localStorage. Auto-updating removes that footgun entirely.
   */
  private watchForUpdates() {
    if (!this.swUpdate.isEnabled) return;
    this.swUpdate.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') {
        this.swUpdate.activateUpdate().then(() => document.location.reload());
      }
    });
    // Poll so long-lived tabs also pick up new deploys.
    setInterval(() => { void this.swUpdate.checkForUpdate().catch(() => undefined); }, 60_000);
  }

  setLang(lang: Lang) {
    this.ls.setLang(lang);
    // Re-trigger all AI analysis in the new language
    // Each effect has its own filters (role required, picks required, etc.)
    // so no unnecessary calls are made
    this.store.dispatch(DraftActions.retryAnalysis());
  }
}
