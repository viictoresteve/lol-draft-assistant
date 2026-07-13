import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { DraftRole } from '@features/draft/models/draft.interface';
import { environment } from 'src/environments/environment';
import { retryBackoff } from '@core/util/retry-backoff';

export interface ChampionTierEntry {
  name: string;
  tier: string;
  winRate: number | null;
  pickRate: number | null;
}

/** Loose shape of an OP.GG / proxy tier item — fields vary by source, all optional */
interface TierItem {
  champion_name?: string;
  name?: string;
  tier?: string | number;
  tier_data?: { tier?: number };
  average_tier_data?: { tier_data?: { tier?: number } };
  win_rate?: number;
  winrate?: number;
  pick_rate?: number;
  pickrate?: number;
}
interface TierResponse {
  champion_stats?: TierItem[];
  champions?: TierItem[];
  data?: { champion_stats?: TierItem[]; champions?: TierItem[] };
}

const TIER_LABELS: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' };
const TIER_STRINGS = new Set(['S', 'A', 'B', 'C', 'D']);

// Data source: our own OP.GG proxy. In local dev `proxyUrl` points at the
// Express server (http://localhost:3001); in production it's empty, so the
// call is same-origin `/api/tier/:role` — a Vercel serverless function on the
// same domain (no CORS, patch-current data). catchError handles any outage.
function buildUrl(role: DraftRole): string {
  return `${environment.proxyUrl}/api/tier/${role}`;
}

@Injectable({ providedIn: 'root' })
export class TierListService {
  private http = inject(HttpClient);

  private cache = new Map<DraftRole, Observable<ChampionTierEntry[] | null>>();

  getChampionTiers(role: DraftRole): Observable<ChampionTierEntry[] | null> {
    if (this.cache.has(role)) {
      return this.cache.get(role)!;
    }
    const req$ = this.http.get<TierResponse>(buildUrl(role)).pipe(
      retryBackoff(),
      map((res) => this.parse(res)),
      catchError(() => of(null)),
      shareReplay(1),
    );
    this.cache.set(role, req$);
    return req$;
  }

  private parse(res: TierResponse): ChampionTierEntry[] {
    const items: TierItem[] =
      res?.data?.champion_stats ??
      res?.champion_stats ??
      res?.data?.champions ??
      res?.champions ??
      [];

    return items
      .map((item) => ({
        name: String(item?.champion_name ?? item?.name ?? '').trim(),
        tier: TIER_STRINGS.has(String(item?.tier))
          ? String(item.tier)   // already mapped to S/A/B/C/D by proxy
          : (TIER_LABELS[
              item?.average_tier_data?.tier_data?.tier ??
              item?.tier_data?.tier ??
              (typeof item?.tier === 'number' ? item.tier : 0)
            ] ?? ''),
        winRate: item?.win_rate ?? item?.winrate ?? null,
        pickRate: item?.pick_rate ?? item?.pickrate ?? null,
      }))
      .filter((e) => e.name.length > 0)
      .sort((a, b) => {
        const order = ['S', 'A', 'B', 'C', 'D', ''];
        return order.indexOf(a.tier) - order.indexOf(b.tier);
      });
  }
}
