import { Injectable, signal } from '@angular/core';
import { environment } from 'src/environments/environment';

const STORAGE_KEY = 'lol-draft-settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private _apiKey = signal<string>(this.loadApiKey());

  readonly apiKey = this._apiKey.asReadonly();

  setApiKey(key: string) {
    this._apiKey.set(key);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      stored.apiKey = key;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // ignore storage errors
    }
  }

  hasCustomKey(): boolean {
    return this._apiKey() !== environment.groqApiKey;
  }

  private loadApiKey(): string {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.apiKey) return parsed.apiKey;
      }
    } catch {
      // ignore
    }
    return environment.groqApiKey;
  }
}
