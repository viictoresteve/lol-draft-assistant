import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { DraftRole } from '@features/draft/models/draft.interface';
import { environment } from 'src/environments/environment';

export interface ChampionTierEntry {
  name: string;
  tier: string;
  winRate: number | null;
  pickRate: number | null;
}

const TIER_LABELS: Record<number, string> = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' };
const TIER_STRINGS = new Set(['S', 'A', 'B', 'C', 'D']);

// When proxyUrl is set the call goes to our Node.js proxy (no CORS issues).
// When it's empty the call goes directly to OP.GG (browser CORS will block it
// in production, but the catchError fallback handles it gracefully).
function buildUrl(role: DraftRole): string {
  const opggRole = role === 'adc' ? 'bot' : role;
  if (environment.proxyUrl) {
    return `${environment.proxyUrl}/api/tier/${role}`;
  }
  return (
    `https://op.gg/api/v1.0/internal/bypass/champions/${opggRole}/ranked` +
    `?hl=en_US&region=global&tier=platinum_plus`
  );
}

@Injectable({ providedIn: 'root' })
export class TierListService {
  private http = inject(HttpClient);

  private cache = new Map<DraftRole, Observable<ChampionTierEntry[] | null>>();

  getChampionTiers(role: DraftRole): Observable<ChampionTierEntry[] | null> {
    if (this.cache.has(role)) {
      return this.cache.get(role)!;
    }
    const req$ = this.http.get<any>(buildUrl(role)).pipe(
      map((res) => this.parse(res)),
      catchError(() => of(null)),
      shareReplay(1),
    );
    this.cache.set(role, req$);
    return req$;
  }

  private parse(res: any): ChampionTierEntry[] {
    const items: any[] =
      res?.data?.champion_stats ??
      res?.champion_stats ??
      res?.data?.champions ??
      res?.champions ??
      [];

    return items
      .map((item: any) => ({
        name: String(item?.champion_name ?? item?.name ?? '').trim(),
        tier: TIER_STRINGS.has(String(item?.tier))
          ? String(item.tier)   // already mapped to S/A/B/C/D by proxy
          : (TIER_LABELS[
              item?.average_tier_data?.tier_data?.tier ??
              item?.tier_data?.tier ??
              item?.tier ?? 0
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
