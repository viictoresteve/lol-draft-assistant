import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';
import { LanguageService } from '@core/services/language.service';
import { PatchService } from '@core/services/patch.service';
import { AI_PROVIDERS } from '@core/services/ai-http.service';

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

  readonly providers = AI_PROVIDERS;

  // Draft values per provider
  groqDraft      = signal('');
  geminiDraft    = signal('');
  openRouterDraft = signal('');

  saved = signal(false);
  showKeys: Record<string, boolean> = {};

  ngOnInit() {
    this.groqDraft.set(this.settingsService.apiKey());
    this.geminiDraft.set(this.settingsService.geminiApiKey());
    this.openRouterDraft.set(this.settingsService.openRouterApiKey());
  }

  save() {
    this.settingsService.setApiKey(this.groqDraft());
    this.settingsService.setGeminiApiKey(this.geminiDraft());
    this.settingsService.setOpenRouterApiKey(this.openRouterDraft());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  toggleShow(id: string) {
    this.showKeys[id] = !this.showKeys[id];
  }

  getDraft(id: string): string {
    if (id === 'groq') return this.groqDraft();
    if (id === 'gemini') return this.geminiDraft();
    if (id === 'openrouter') return this.openRouterDraft();
    return '';
  }

  setDraft(id: string, value: string) {
    if (id === 'groq') this.groqDraft.set(value);
    else if (id === 'gemini') this.geminiDraft.set(value);
    else if (id === 'openrouter') this.openRouterDraft.set(value);
  }

  isActive(id: string): boolean {
    return !!this.getDraft(id);
  }

  readonly placeholders: Record<string, string> = {
    groq:        'gsk_...',
    gemini:      'AIza...',
    openrouter:  'sk-or-...',
  };
}
