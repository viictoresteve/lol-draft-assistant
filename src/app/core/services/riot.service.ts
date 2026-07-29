import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

/** One entry of a player's champion mastery, returned by /api/summoner. */
export interface RiotTopChampion {
  championId: number; // numeric DDragon key (e.g. 103 = Ahri)
  championLevel: number;
  championPoints: number;
}

export interface SummonerLookup {
  gameName: string;
  tagLine: string;
  region: string;
  top: RiotTopChampion[];
}

/** Ranked-ladder standing for a player (from League-V4). */
export interface RankInfo {
  queue: string;   // 'Solo/Duo' | 'Flex'
  tier: string;    // GOLD, PLATINUM…
  division: string; // I–IV
  lp: number;
  wins: number;
  losses: number;
}

/** Per-champion record from recent ranked games (Match-V5). */
export interface ProfileChampion {
  championId: number;
  championName: string;
  games: number;
  wins: number;
  winRate: number; // 0–100
}

/** Rich player profile: rank + real role split + per-champ win rates. */
export interface PlayerProfile {
  gameName: string;
  tagLine: string;
  region: string;
  rank: RankInfo | null;
  roles: { role: string; games: number }[];
  champions: ProfileChampion[];
  sampleSize: number;
}

/** A failed lookup, normalised to a machine-readable code the UI can branch on. */
export interface RiotLookupError {
  code: 'NO_KEY' | 'NOT_FOUND' | 'BAD_KEY' | 'RATE' | 'BAD_INPUT' | 'UNKNOWN';
  message: string;
}

/** Riot platforms we support, with display labels. */
export const RIOT_REGIONS: { id: string; label: string }[] = [
  { id: 'euw1', label: 'EUW' },
  { id: 'eun1', label: 'EUNE' },
  { id: 'na1', label: 'NA' },
  { id: 'kr', label: 'KR' },
  { id: 'br1', label: 'BR' },
  { id: 'la1', label: 'LAN' },
  { id: 'la2', label: 'LAS' },
  { id: 'oc1', label: 'OCE' },
  { id: 'jp1', label: 'JP' },
  { id: 'tr1', label: 'TR' },
  { id: 'ru', label: 'RU' },
];

/**
 * Fetches a player's most-played champions through our proxy (never Riot
 * directly — the API key is server-side only). Errors are normalised into
 * {@link RiotLookupError} so the component can show the right message.
 */
@Injectable({ providedIn: 'root' })
export class RiotService {
  private http = inject(HttpClient);

  getTopChampions(gameName: string, tagLine: string, region: string): Observable<RiotTopChampion[]> {
    const params = new HttpParams()
      .set('gameName', gameName)
      .set('tagLine', tagLine)
      .set('region', region);

    return this.http
      .get<SummonerLookup>(`${environment.proxyUrl}/api/summoner`, { params })
      .pipe(
        map((res) => res.top ?? []),
        catchError((err: HttpErrorResponse) => throwError(() => this.normalise(err))),
      );
  }

  /** Rich profile (rank + real roles + per-champ win rate) from ranked history. */
  getProfile(gameName: string, tagLine: string, region: string): Observable<PlayerProfile> {
    const params = new HttpParams()
      .set('gameName', gameName)
      .set('tagLine', tagLine)
      .set('region', region);

    return this.http
      .get<PlayerProfile>(`${environment.proxyUrl}/api/profile`, { params })
      .pipe(catchError((err: HttpErrorResponse) => throwError(() => this.normalise(err))));
  }

  private normalise(err: HttpErrorResponse): RiotLookupError {
    const code = (err.error?.code as RiotLookupError['code']) ?? undefined;
    if (code) return { code, message: String(err.error?.error ?? 'Lookup failed') };
    switch (err.status) {
      case 404: return { code: 'NOT_FOUND', message: 'Riot ID not found' };
      case 429: return { code: 'RATE', message: 'Rate limited — try again shortly' };
      case 501: return { code: 'NO_KEY', message: 'Riot lookup is not configured on the server' };
      case 400: return { code: 'BAD_INPUT', message: 'Invalid Riot ID' };
      default: return { code: 'UNKNOWN', message: 'Could not reach the Riot API' };
    }
  }
}
