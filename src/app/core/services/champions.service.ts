import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, defer, map, shareReplay, catchError, throwError } from 'rxjs';
import { Champion, ChampionTag } from '@shared/models/champion.interface';
import { PatchService } from '@core/services/patch.service';
import { retryBackoff } from '@core/util/retry-backoff';

/** Shape of the entries in DDragon's champion.json */
interface DDragonChampion {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: ChampionTag[];
}
interface DDragonChampionList {
  data: Record<string, DDragonChampion>;
}

@Injectable({
  providedIn: 'root',
})
export class ChampionsService {
  private http = inject(HttpClient);
  private patchService = inject(PatchService);

  /** Lazily-built shared stream. Reset to undefined on total failure so the
   *  next caller re-fetches instead of being stuck with a cached error. */
  private champions$?: Observable<Champion[]>;

  getChampions(): Observable<Champion[]> {
    if (!this.champions$) {
      this.champions$ = defer(() => {
        const version = this.patchService.version();
        return this.http
          .get<DDragonChampionList>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
          .pipe(map((response) => this.mapToChampions(response.data, version)));
      }).pipe(
        retryBackoff(),
        catchError((err) => { this.champions$ = undefined; return throwError(() => err); }),
        shareReplay(1),
      );
    }
    return this.champions$;
  }

  getChampionImageUrl(championId: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}/img/champion/${championId}.png`;
  }

  private mapToChampions(data: Record<string, DDragonChampion>, version: string): Champion[] {
    return Object.values(data).map((champ) => ({
      id: champ.id,
      key: champ.key,
      name: champ.name,
      title: champ.title,
      image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.id}.png`,
      tags: champ.tags,
    }));
  }
}
