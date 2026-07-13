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

/** One round of a stored match — what the player faced and how they did. */
export interface MatchRound {
  id: string;    // champion id, to rebuild the icon
  name: string;  // champion name
  ok: boolean;   // correct / good pick
  pts: number;   // points earned
  tag?: string;  // optional label (ability slot, puzzle grade…)
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

  submit(game: LeaderboardGame, name: string, score: number, match: MatchRound[] = []): Observable<LeaderboardEntry[]> {
    this.setName(name);
    return this.http
      .post<LeaderboardResponse>(`${environment.proxyUrl}/api/leaderboard/${game}`, { name, score, match })
      .pipe(map((r) => r.entries ?? []), catchError(() => of([])));
  }

  /** The stored round-by-round history of a player's best game. */
  getMatch(game: LeaderboardGame, player: string): Observable<MatchRound[]> {
    return this.http
      .get<{ rounds?: MatchRound[] }>(
        `${environment.proxyUrl}/api/leaderboard/${game}?player=${encodeURIComponent(player)}`,
      )
      .pipe(map((r) => r.rounds ?? []), catchError(() => of([])));
  }

  private readName(): string {
    try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
  }
}
