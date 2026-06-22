import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { PatchService } from '@core/services/patch.service';
import { LanguageService } from '@core/services/language.service';
import { AbilityInfo, AbilitySlot } from '@features/ability-quiz/models/ability-quiz.interface';

const DDRAGON_LOCALE: Record<string, string> = { en: 'en_US', es: 'es_ES' };

/** Relevant subset of a DDragon champion detail document */
interface DDragonImage { full?: string }
interface DDragonSpell { name?: string; description?: string; image?: DDragonImage }
interface DDragonChampionDetail {
  passive?: { name?: string; description?: string; image?: DDragonImage };
  spells?: DDragonSpell[];
}
interface DDragonDetailResponse {
  data?: Record<string, DDragonChampionDetail>;
}

@Injectable({ providedIn: 'root' })
export class ChampionDetailService {
  private http = inject(HttpClient);
  private patchService = inject(PatchService);
  private ls = inject(LanguageService);

  private cache = new Map<string, Observable<AbilityInfo[]>>();

  /** Returns [Passive, Q, W, E, R] for a champion, from DDragon (real data). */
  getAbilities(championId: string): Observable<AbilityInfo[]> {
    const patch = this.patchService.version();
    const locale = DDRAGON_LOCALE[this.ls.lang()] ?? 'en_US';
    const key = `${championId}:${patch}:${locale}`;

    if (this.cache.has(key)) return this.cache.get(key)!;

    const base = `https://ddragon.leagueoflegends.com/cdn/${patch}`;
    const req$ = this.http
      .get<DDragonDetailResponse>(`${base}/data/${locale}/champion/${championId}.json`)
      .pipe(
        map((res) => this.parse(res, championId, base)),
        shareReplay(1),
      );
    this.cache.set(key, req$);
    return req$;
  }

  private parse(res: DDragonDetailResponse, championId: string, base: string): AbilityInfo[] {
    const champ = res?.data?.[championId];
    if (!champ) return [];

    const clean = (html?: string) => String(html ?? '').replace(/<[^>]+>/g, '').trim();

    const passive: AbilityInfo = {
      slot: 'P',
      name: champ.passive?.name ?? 'Passive',
      description: clean(champ.passive?.description),
      iconUrl: `${base}/img/passive/${champ.passive?.image?.full}`,
    };

    const slots: AbilitySlot[] = ['Q', 'W', 'E', 'R'];
    const spells: AbilityInfo[] = (champ.spells ?? []).slice(0, 4).map((sp, i) => ({
      slot: slots[i],
      name: sp.name ?? slots[i],
      description: clean(sp.description),
      iconUrl: `${base}/img/spell/${sp.image?.full}`,
    }));

    return [passive, ...spells];
  }
}
