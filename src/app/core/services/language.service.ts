import { Injectable, signal, computed } from '@angular/core';
import { TRANSLATIONS, Lang } from '@core/i18n/translations';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  lang = signal<Lang>((localStorage.getItem('lol-draft-lang') as Lang) ?? 'en');

  T = computed(() => TRANSLATIONS[this.lang()]);

  setLang(lang: Lang) {
    this.lang.set(lang);
    localStorage.setItem('lol-draft-lang', lang);
  }
}
