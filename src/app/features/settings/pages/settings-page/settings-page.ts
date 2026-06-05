import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';
import { LanguageService } from '@core/services/language.service';
import { PatchService } from '@core/services/patch.service';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage implements OnInit {
  settingsService = inject(SettingsService);
  ls = inject(LanguageService);
  patchService = inject(PatchService);

  keyDraft = signal('');
  saved = signal(false);
  showKey = signal(false);

  ngOnInit() {
    this.keyDraft.set(this.settingsService.apiKey());
  }

  save() {
    this.settingsService.setApiKey(this.keyDraft());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  toggleShowKey() {
    this.showKey.update((v) => !v);
  }
}
