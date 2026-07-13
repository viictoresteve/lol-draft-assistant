import { defer, of, throwError } from 'rxjs';
import { retryBackoff } from './retry-backoff';

describe('retryBackoff', () => {
  it('re-subscribes after transient failures and eventually succeeds', () => {
    let attempts = 0;
    const source = defer(() => {
      attempts++;
      return attempts < 3 ? throwError(() => new Error('blip')) : of('ok');
    });

    return new Promise<void>((resolve, reject) => {
      source.pipe(retryBackoff(3)).subscribe({
        next: (value) => {
          try {
            expect(value).toBe('ok');
            expect(attempts).toBe(3); // 1 initial + 2 retries
            resolve();
          } catch (e) { reject(e); }
        },
        error: reject,
      });
    });
  });

  it('gives up and surfaces the error after exhausting retries', () => {
    let attempts = 0;
    const source = defer(() => {
      attempts++;
      return throwError(() => new Error('down'));
    });

    return new Promise<void>((resolve, reject) => {
      source.pipe(retryBackoff(1)).subscribe({
        next: () => reject(new Error('should not emit')),
        error: () => {
          try {
            expect(attempts).toBe(2); // 1 initial + 1 retry
            resolve();
          } catch (e) { reject(e); }
        },
      });
    });
  });
});
