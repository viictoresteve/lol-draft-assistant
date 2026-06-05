import { Injectable, signal } from '@angular/core';
import { environment } from 'src/environments/environment';

const STORAGE_KEY = 'lol-draft-settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private _apiKey         = signal<string>(this.load('apiKey', environment.groqApiKey));
  private _geminiApiKey   = signal<string>(this.load('geminiApiKey', ''));
  private _openRouterApiKey = signal<string>(this.load('openRouterApiKey', ''));

  readonly apiKey          = this._apiKey.asReadonly();
  readonly geminiApiKey    = this._geminiApiKey.asReadonly();
  readonly openRouterApiKey = this._openRouterApiKey.asReadonly();

  setApiKey(key: string)           { this._apiKey.set(key);          this.save('apiKey', key); }
  setGeminiApiKey(key: string)     { this._geminiApiKey.set(key);    this.save('geminiApiKey', key); }
  setOpenRouterApiKey(key: string) { this._openRouterApiKey.set(key); this.save('openRouterApiKey', key); }

  /** True if at least one provider key is configured */
  hasAnyKey(): boolean {
    return !!(this._apiKey() || this._geminiApiKey() || this._openRouterApiKey());
  }

  private load(field: string, fallback: string): string {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[field]) return parsed[field];
      }
    } catch {}
    return fallback;
  }

  private save(field: string, value: string) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      stored[field] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {}
  }
}
