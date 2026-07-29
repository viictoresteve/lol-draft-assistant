import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SettingsService } from '@core/services/settings.service';
import { ToastService } from '@core/services/toast.service';
import { LanguageService } from '@core/services/language.service';

export interface AIProvider {
  id: string;
  name: string;
  url: string;
  model: string;
  getKey: (s: SettingsService) => string;
  freeKeyUrl: string;
  /** Provider reliably supports OpenAI `response_format: json_object` */
  jsonMode: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'gemini',
    name: 'Gemini 2.5 Flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash',
    getKey: (s) => s.geminiApiKey(),
    freeKeyUrl: 'https://aistudio.google.com/apikey',
    jsonMode: true,
  },
  {
    id: 'groq',
    name: 'Groq (LLaMA 3.3 70B)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    getKey: (s) => s.apiKey(),
    freeKeyUrl: 'https://console.groq.com/keys',
    jsonMode: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    getKey: (s) => s.openRouterApiKey(),
    freeKeyUrl: 'https://openrouter.ai/keys',
    jsonMode: false, // free models reject response_format inconsistently
  },
];

/** Status of the last AI request — useful for showing which provider is active */
export interface ProviderStatus {
  active: string | null;  // provider id that last succeeded
  fallbackUsed: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AIHttpService {
  private http = inject(HttpClient);
  private settings = inject(SettingsService);
  private toast = inject(ToastService);
  private ls = inject(LanguageService);

  readonly status = signal<ProviderStatus>({ active: null, fallbackUsed: false, error: null });

  /** POST to the AI API, trying providers in order until one succeeds */
  post<T>(body: object): Observable<T> {
    const candidates = AI_PROVIDERS.filter(p => !!p.getKey(this.settings));
    if (candidates.length === 0) {
      return throwError(() => ({ status: 401, message: 'NO_API_KEY' }));
    }
    return this.tryProvider<T>(body, candidates, 0);
  }

  private tryProvider<T>(body: object, providers: AIProvider[], idx: number): Observable<T> {
    if (idx >= providers.length) {
      this.status.set({ active: null, fallbackUsed: idx > 0, error: 'All providers exhausted' });
      this.toast.warning(this.ls.T().aiRateLimited);
      return throwError(() => ({ status: 503, message: 'All AI providers exhausted or rate-limited' }));
    }

    const provider = providers[idx];
    const key = provider.getKey(this.settings);

    // Force valid-JSON output on providers that support it — cuts parse failures.
    // (All our prompts already instruct "respond ONLY with valid JSON".)
    const payload = provider.jsonMode
      ? { ...body, model: provider.model, response_format: { type: 'json_object' } }
      : { ...body, model: provider.model };

    return this.http
      .post<T>(
        provider.url,
        payload,
        { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } },
      )
      .pipe(
        tap(() => {
          this.status.set({ active: provider.id, fallbackUsed: idx > 0, error: null });
          if (idx > 0) {
            console.info(`[AI] Fallback to ${provider.name} (providers 0..${idx - 1} failed)`);
          }
        }),
        catchError((err) => {
          const isRetryable = [429, 401, 503, 502, 500].includes(err?.status);
          if (isRetryable && idx < providers.length - 1) {
            console.warn(`[AI] ${provider.name} returned ${err.status} — trying next provider`);
            return this.tryProvider<T>(body, providers, idx + 1);
          }
          this.status.set({
            active: null,
            fallbackUsed: idx > 0,
            error: err?.status === 429 ? 'RATE_LIMITED' : err?.status === 401 ? 'NO_API_KEY' : err?.message,
          });
          // Surface it — but 401/NO_API_KEY is already covered by the top banner.
          if (err?.status === 429) this.toast.warning(this.ls.T().aiRateLimited);
          else if (err?.status !== 401) this.toast.error(this.ls.T().aiFailed);
          throw err;
        }),
      );
  }
}
