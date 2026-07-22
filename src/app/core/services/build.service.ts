import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { retryBackoff } from '@core/util/retry-backoff';
import { DraftRole } from '@features/draft/models/draft.interface';
import { catchError, Observable, of, shareReplay } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ChampionBuild {
  coreItems: { id: number; name: string }[];
  boots: { id: number; name: string } | null;
  starterItems: { id: number; name: string }[];
  summonerSpells: { id: number; name: string }[];
  runes: {
    keystone: string;
    primaryTree: string;
    secondaryTree: string;
    primary: string[];
    secondary: string[];
  };
  skillOrder: string[];
  skillLevels: string[];
  combos: { name: string; url: string }[];
  winRate: number;
}

@Injectable({ providedIn: 'root' })
export class BuildService {
  private http = inject(HttpClient);
  private cache = new Map<string, Observable<ChampionBuild | null>>();

  getBuild(champion: string, role: DraftRole): Observable<ChampionBuild | null> {
    const key = `${champion}:${role}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const req$ = this.http
      .get<ChampionBuild>(
        `${environment.proxyUrl}/api/build/${encodeURIComponent(champion)}?position=${role}`,
      )
      .pipe(
        retryBackoff(2),
        catchError(() => of(null)),
        shareReplay(1),
      );
    this.cache.set(key, req$);
    return req$;
  }
}
