import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, from } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { selectDraftForSave } from '@store/draft/draft.selectors';
import { DraftPick, DraftSide, DraftRole } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';

interface CompactPick {
  i: string;
  n: string;
  r: string;
}

interface CompactBan {
  i: string;
  n: string;
}

interface CompactDraft {
  ap: CompactPick[];
  ep: CompactPick[];
  ab: CompactBan[];
  eb: CompactBan[];
  s: DraftSide;
  r: DraftRole | null;
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  private store = inject(Store);

  generateUrl(): Observable<string> {
    return this.store.select(selectDraftForSave).pipe(
      take(1),
      map(({ allyPicks, enemyPicks, allyBans, enemyBans, side, userRole }) => {
        const compact: CompactDraft = {
          ap: allyPicks
            .filter((p) => p.champion)
            .map((p) => ({ i: p.champion!.id, n: p.champion!.name, r: p.role })),
          ep: enemyPicks
            .filter((p) => p.champion)
            .map((p) => ({ i: p.champion!.id, n: p.champion!.name, r: p.role })),
          ab: allyBans.map((c) => ({ i: c.id, n: c.name })),
          eb: enemyBans.map((c) => ({ i: c.id, n: c.name })),
          s: side,
          r: userRole,
        };
        const encoded = btoa(JSON.stringify(compact));
        return `${window.location.origin}/draft?d=${encoded}`;
      }),
    );
  }

  copyLink(): Observable<boolean> {
    return this.generateUrl().pipe(
      switchMap((url) => from(navigator.clipboard.writeText(url)).pipe(map(() => true))),
    );
  }

  parseUrl(encoded: string): {
    allyPicks: DraftPick[];
    enemyPicks: DraftPick[];
    allyBans: Champion[];
    enemyBans: Champion[];
    userRole: DraftRole | null;
    side: DraftSide;
  } | null {
    try {
      const compact: CompactDraft = JSON.parse(atob(encoded));

      const roles: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

      const allyPicksMap = new Map(compact.ap.map((p) => [p.r as DraftRole, p]));
      const enemyPicksMap = new Map(compact.ep.map((p) => [p.r as DraftRole, p]));

      const allyPicks: DraftPick[] = roles.map((role) => {
        const p = allyPicksMap.get(role);
        return {
          role,
          champion: p
            ? { id: p.i, name: p.n, title: '', image: '', tags: [] }
            : null,
        };
      });

      const enemyPicks: DraftPick[] = roles.map((role) => {
        const p = enemyPicksMap.get(role);
        return {
          role,
          champion: p
            ? { id: p.i, name: p.n, title: '', image: '', tags: [] }
            : null,
        };
      });

      const allyBans: Champion[] = (compact.ab ?? []).map((b) => ({
        id: b.i,
        name: b.n,
        title: '',
        image: '',
        tags: [],
      }));

      const enemyBans: Champion[] = (compact.eb ?? []).map((b) => ({
        id: b.i,
        name: b.n,
        title: '',
        image: '',
        tags: [],
      }));

      return {
        allyPicks,
        enemyPicks,
        allyBans,
        enemyBans,
        userRole: compact.r ?? null,
        side: compact.s ?? 'blue',
      };
    } catch {
      return null;
    }
  }
}
