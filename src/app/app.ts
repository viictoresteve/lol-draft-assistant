import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { LanguageService } from '@core/services/language.service';
import { Lang } from '@core/i18n/translations';
import * as PoolActions from '@store/pool/pool.actions';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App implements OnInit {
  private store = inject(Store);
  ls = inject(LanguageService);

  ngOnInit() {
    this.store.dispatch(PoolActions.loadPool());
  }

  setLang(lang: Lang) {
    this.ls.setLang(lang);
  }
}
