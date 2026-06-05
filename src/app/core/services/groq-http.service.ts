import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { timer } from 'rxjs';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Thin HTTP client for the Groq API.
 * Auth header is handled by groqInterceptor — do NOT add Authorization here.
 * Retry logic for 429 (rate limit) is handled here.
 */
@Injectable({ providedIn: 'root' })
export class GroqHttpService {
  private http = inject(HttpClient);

  post<T>(body: object): Observable<T> {
    return this.http
      .post<T>(GROQ_URL, body, {
        headers: { 'Content-Type': 'application/json' },
      })
      .pipe(
        retry({
          count: 3,
          delay: (error, retryCount) => {
            if (error.status === 429) return timer(retryCount * 3000);
            throw error;
          },
        }),
      );
  }
}
