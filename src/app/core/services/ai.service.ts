import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Champion } from '@shared/models/champion.interface';
import { DraftPick, Suggestion } from '@features/draft/models/draft.interface';
import { environment } from 'src/environments/environment';

export interface DraftAnalysisRequest {
  allyPicks: DraftPick[];
  enemyPicks: DraftPick[];
  allyBans: Champion[];
  enemyBans: Champion[];
}

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private http = inject(HttpClient);
  private readonly API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  private readonly API_KEY = environment.geminiApiKey;

  analyzeDraft(request: DraftAnalysisRequest): Observable<Suggestion[]> {
    const prompt = this.buildPrompt(request);

    return this.http
      .post<any>(`${this.API_URL}?key=${this.API_KEY}`, {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      })
      .pipe(map((response) => this.parseResponse(response)));
  }

  private buildPrompt(request: DraftAnalysisRequest): string {
    const allyPicks = request.allyPicks
      .filter((p) => p.champion)
      .map((p) => `${p.role}: ${p.champion!.name}`)
      .join(', ');

    const enemyPicks = request.enemyPicks
      .filter((p) => p.champion)
      .map((p) => `${p.role}: ${p.champion!.name}`)
      .join(', ');

    const allyBans = request.allyBans.map((c) => c.name).join(', ');
    const enemyBans = request.enemyBans.map((c) => c.name).join(', ');

    return `
      You are a League of Legends expert coach. Analyze this draft and suggest the best champion picks.
      
      Ally picks: ${allyPicks || 'none yet'}
      Enemy picks: ${enemyPicks || 'none yet'}
      Ally bans: ${allyBans || 'none'}
      Enemy bans: ${enemyBans || 'none'}
      
      Respond ONLY with a valid JSON array, no markdown, no explanation. Format:
      [
        {
          "championId": "Ahri",
          "championName": "Ahri",
          "reason": "Strong blind pick with good matchup against current enemy comp",
          "isInPool": false
        }
      ]
      
      Suggest 5 champions maximum.
    `;
  }

  private parseResponse(response: any): Suggestion[] {
    try {
      const text = response.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);

      return parsed.map((item: any) => ({
        champion: {
          id: item.championId,
          name: item.championName,
          title: '',
          image: `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${item.championId}.png`,
          tags: [],
        },
        reason: item.reason,
        isInPool: item.isInPool,
      }));
    } catch {
      return [];
    }
  }
}
