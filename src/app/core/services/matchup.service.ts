import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { DraftRole } from '@features/draft/models/draft.interface';
import { environment } from 'src/environments/environment';

export interface ChampionCounter {
  name: string;
  winRate: number; // 0–100
  games: number;
}

export interface ChampionMatchupData {
  champion: string;
  position: string;
  damageType: 'AP' | 'AD' | 'MIXED' | 'TRUE';
  counters: ChampionCounter[];
}

@Injectable({ providedIn: 'root' })
export class MatchupService {
  private http = inject(HttpClient);
  private cache = new Map<string, Observable<ChampionMatchupData | null>>();

  getCounters(championName: string, role: DraftRole): Observable<ChampionMatchupData | null> {
    const key = `${championName}:${role}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    // Local dev → Express proxy; production → same-origin `/api` Vercel function.
    const req$ = this.http
      .get<ChampionMatchupData>(
        `${environment.proxyUrl}/api/counters/${encodeURIComponent(championName)}?position=${role}`,
      )
      .pipe(
        catchError(() => of(null)),
        shareReplay(1),
      );
    this.cache.set(key, req$);
    return req$;
  }
}
