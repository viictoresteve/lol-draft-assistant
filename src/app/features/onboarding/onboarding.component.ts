import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { LanguageService } from '@core/services/language.service';
import { Lang } from '@core/i18n/translations';

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  ls = inject(LanguageService);

  show = signal(!localStorage.getItem('lol-draft-onboarded'));

  setLang(lang: Lang) {
    this.ls.setLang(lang);
  }

  dismiss() {
    localStorage.setItem('lol-draft-onboarded', '1');
    this.show.set(false);
  }
}
