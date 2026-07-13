import { MonoTypeOperatorFunction, retry, timer } from 'rxjs';

/**
 * Retry a failed stream a few times with exponential backoff before giving up.
 * Smooths over transient network blips on external data (DDragon, OP.GG,
 * Upstash, Community Dragon) so the app self-heals instead of failing on a
 * single hiccup. Delays: ~400ms, 800ms, 1600ms (capped at 4s).
 */
export function retryBackoff<T>(count = 3): MonoTypeOperatorFunction<T> {
  return retry<T>({
    count,
    delay: (_err, retryIndex) => timer(Math.min(400 * 2 ** (retryIndex - 1), 4000)),
  });
}
