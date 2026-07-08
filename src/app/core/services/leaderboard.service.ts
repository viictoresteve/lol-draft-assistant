import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export type LeaderboardGame = 'puzzle' | 'abilities' | 'sounds';

export interface LeaderboardEntry {
  name: string;
  score: number;
}

interface LeaderboardResponse {
  entries?: LeaderboardEntry[];
}

const NAME_KEY = 'lol-player-name';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private http = inject(HttpClient);

  /** Persisted player name so it's pre-filled across games and sessions. */
  playerName = signal<string>(this.readName());

  setName(name: string) {
    const clean = name.trim().slice(0, 20);
    this.playerName.set(clean);
    try { localStorage.setItem(NAME_KEY, clean); } catch { /* ignore */ }
  }

  getTop(game: LeaderboardGame): Observable<LeaderboardEntry[]> {
    return this.http
      .get<LeaderboardResponse>(`${environment.proxyUrl}/api/leaderboard/${game}`)
      .pipe(map((r) => r.entries ?? []), catchError(() => of([])));
  }

  submit(game: LeaderboardGame, name: string, score: number): Observable<LeaderboardEntry[]> {
    this.setName(name);
    return this.http
      .post<LeaderboardResponse>(`${environment.proxyUrl}/api/leaderboard/${game}`, { name, score })
      .pipe(map((r) => r.entries ?? []), catchError(() => of([])));
  }

  private readName(): string {
    try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
  }
}
