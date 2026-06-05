import { Injectable } from '@angular/core';
import { DraftPick, DraftRole, DraftSide } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';

export interface DraftHistoryEntry {
  id: string;
  timestamp: number;
  allyPicks: DraftPick[];
  enemyPicks: DraftPick[];
  allyBans: Champion[];
  enemyBans: Champion[];
  userRole: DraftRole | null;
  side: DraftSide;
  result?: 'win' | 'loss';
}

const KEY = 'lol-draft-history';
const MAX = 5;

@Injectable({ providedIn: 'root' })
export class DraftHistoryService {
  getAll(): DraftHistoryEntry[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as DraftHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  save(entry: Omit<DraftHistoryEntry, 'id' | 'timestamp'>) {
    const filledPicks = [...entry.allyPicks, ...entry.enemyPicks].filter((p) => p.champion).length;
    if (filledPicks < 2) return;

    const current = this.getAll();
    const newEntry: DraftHistoryEntry = { ...entry, id: Date.now().toString(), timestamp: Date.now() };
    const updated = [newEntry, ...current].slice(0, MAX);
    try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch {}
  }

  updateResult(id: string, result: 'win' | 'loss') {
    const entries = this.getAll();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], result };
      try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
    }
  }

  getWinRate(): { wins: number; losses: number; rate: number } {
    const withResult = this.getAll().filter((e) => e.result !== undefined);
    const wins = withResult.filter((e) => e.result === 'win').length;
    const losses = withResult.filter((e) => e.result === 'loss').length;
    const total = wins + losses;
    return { wins, losses, rate: total > 0 ? Math.round((wins / total) * 100) : 0 };
  }

  clear() { localStorage.removeItem(KEY); }

  timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
