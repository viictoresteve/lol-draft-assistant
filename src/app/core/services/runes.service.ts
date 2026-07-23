import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PatchService } from '@core/services/patch.service';
import { retryBackoff } from '@core/util/retry-backoff';

/** DDragon runesReforged.json shapes (only the fields we need). */
interface DDragonRune { id: number; name: string; icon: string; }
interface DDragonRuneSlot { runes: DDragonRune[]; }
interface DDragonRuneTree { id: number; name: string; icon: string; slots: DDragonRuneSlot[]; }

const CDN_IMG = 'https://ddragon.leagueoflegends.com/cdn/img/';

/**
 * Loads DDragon's rune tree once and exposes a name → icon-URL lookup, so the
 * build panel can render real rune icons instead of plain text. Names come from
 * OP.GG in en_US, matching DDragon's en_US rune data.
 */
@Injectable({ providedIn: 'root' })
export class RunesService {
  private http = inject(HttpClient);
  private patch = inject(PatchService);

  // name (lowercased) → full icon URL, for both trees and individual runes.
  private iconByName = signal<Map<string, string>>(new Map());

  constructor() {
    const version = this.patch.version();
    this.http
      .get<DDragonRuneTree[]>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`)
      .pipe(retryBackoff())
      .subscribe({
        next: (trees) => this.iconByName.set(this.buildMap(trees)),
        error: () => { /* icons just won't show — the panel falls back to text */ },
      });
  }

  /** Icon URL for a rune or tree name, or null if unknown. */
  icon(name: string): string | null {
    return this.iconByName().get(name.toLowerCase().trim()) ?? null;
  }

  private buildMap(trees: DDragonRuneTree[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const tree of trees) {
      map.set(tree.name.toLowerCase(), CDN_IMG + tree.icon);
      for (const slot of tree.slots) {
        for (const rune of slot.runes) {
          map.set(rune.name.toLowerCase(), CDN_IMG + rune.icon);
        }
      }
    }
    return map;
  }
}
