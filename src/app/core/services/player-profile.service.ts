import { Injectable, computed, signal } from '@angular/core';
import { PlayerProfile, ProfileChampion } from '@core/services/riot.service';

const STORAGE_KEY = 'lol-player-profile';

/**
 * Holds the looked-up player's profile app-wide (rank + real roles + per-champ
 * win rate) and persists it to localStorage, so the draft AI can personalise
 * suggestions ("you're 58% WR on this") across the whole app and page reloads.
 */
@Injectable({ providedIn: 'root' })
export class PlayerProfileService {
  readonly profile = signal<PlayerProfile | null>(this.load());

  /** Per-champion recent record keyed by numeric DDragon id, for quick lookup. */
  readonly byChampId = computed(
    () => new Map<number, ProfileChampion>((this.profile()?.champions ?? []).map((c) => [c.championId, c])),
  );

  /** Same records keyed by lowercased champion name (Match-V5 = DDragon id style). */
  readonly byName = computed(
    () => new Map<string, ProfileChampion>(
      (this.profile()?.champions ?? []).map((c) => [c.championName.toLowerCase(), c]),
    ),
  );

  /** True once a profile has been looked up (enables personalised UI). */
  readonly hasProfile = computed(() => this.profile() !== null);

  set(profile: PlayerProfile | null): void {
    this.profile.set(profile);
    this.persist(profile);
  }

  clear(): void {
    this.set(null);
  }

  /** Recent record for a champion by numeric id, or undefined if not played. */
  recordFor(championId: number | string | undefined): ProfileChampion | undefined {
    if (championId == null) return undefined;
    return this.byChampId().get(Number(championId));
  }

  /** Recent record by DDragon id / name (e.g. "MonkeyKing"), or undefined. */
  recordForName(name: string | undefined): ProfileChampion | undefined {
    return name ? this.byName().get(name.toLowerCase()) : undefined;
  }

  private load(): PlayerProfile | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PlayerProfile) : null;
    } catch {
      return null;
    }
  }

  private persist(profile: PlayerProfile | null): void {
    try {
      if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — in-memory signal still works for this session */
    }
  }
}
