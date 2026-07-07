import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, defer, map, shareReplay } from 'rxjs';
import { Champion, ChampionTag } from '@shared/models/champion.interface';
import { PatchService } from '@core/services/patch.service';

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

  private readonly champions$: Observable<Champion[]> = defer(() => {
    const version = this.patchService.version();
    return this.http
      .get<DDragonChampionList>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
      .pipe(map((response) => this.mapToChampions(response.data, version)));
  }).pipe(shareReplay(1));

  getChampions(): Observable<Champion[]> {
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
