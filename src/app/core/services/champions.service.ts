import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Champion } from '@shared/models/champion.interface';

@Injectable({
  providedIn: 'root',
})
export class ChampionsService {
  private readonly VERSION = '15.8.1';
  private readonly BASE_URL = `https://ddragon.leagueoflegends.com/cdn/${this.VERSION}`;

  constructor(private http: HttpClient) {}

  getChampions(): Observable<Champion[]> {
    return this.http
      .get<any>(`${this.BASE_URL}/data/en_US/champion.json`)
      .pipe(map((response) => this.mapToChampions(response.data)));
  }

  getChampionImageUrl(championId: string): string {
    return `${this.BASE_URL}/img/champion/${championId}.png`;
  }

  private mapToChampions(data: any): Champion[] {
    return Object.values(data).map((champ: any) => ({
      id: champ.id,
      name: champ.name,
      title: champ.title,
      image: this.getChampionImageUrl(champ.id),
      tags: champ.tags,
    }));
  }
}
