import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import { DraftPick, DraftRole, DraftSide, Suggestion } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';
import { LanguageService } from '@core/services/language.service';
import { environment } from 'src/environments/environment';

export interface DraftAnalysisRequest {
  allyPicks: DraftPick[];
  enemyPicks: DraftPick[];
  allyBans: Champion[];
  enemyBans: Champion[];
  userRole?: DraftRole;
  poolChampions?: string[];
  side?: DraftSide;
}

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private http = inject(HttpClient);
  private ls = inject(LanguageService);
  private readonly API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly API_KEY = environment.groqApiKey;

  analyzeDraft(request: DraftAnalysisRequest): Observable<Suggestion[]> {
    const prompt = this.buildPrompt(request);

    return this.http
      .post<any>(
        this.API_URL,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      )
      .pipe(
        retry({
          count: 3,
          delay: (error, retryCount) => {
            if (error.status === 429) {
              return timer(retryCount * 3000);
            }
            throw error;
          },
        }),
        map((response) => this.parseResponse(response)),
      );
  }

  private buildPrompt(request: DraftAnalysisRequest): string {
    const roles: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

    const allyByRole = new Map(request.allyPicks.map((p) => [p.role, p.champion?.name]));
    const enemyByRole = new Map(request.enemyPicks.map((p) => [p.role, p.champion?.name]));

    const roleTable = roles
      .map((role) => {
        const ally = allyByRole.get(role) ?? '(open)';
        const enemy = enemyByRole.get(role) ?? '(open)';
        return `  ${role.toUpperCase().padEnd(8)} Ally → ${ally.padEnd(16)} | Enemy → ${enemy}`;
      })
      .join('\n');

    const allyBansStr = request.allyBans.length
      ? request.allyBans.map((c) => c.name).join(', ')
      : 'none';

    const enemyBansStr = request.enemyBans.length
      ? request.enemyBans.map((c) => c.name).join(', ')
      : 'none';

    const poolStr =
      request.poolChampions && request.poolChampions.length > 0
        ? request.poolChampions.join(', ')
        : null;

    const hasAnyPick =
      request.allyPicks.some((p) => p.champion) || request.enemyPicks.some((p) => p.champion);

    const roleSection = request.userRole
      ? `The player's role is: ${request.userRole.toUpperCase()}.
All 5 suggestions MUST be champions that play the ${request.userRole.toUpperCase()} role.
Their lane opponent is the enemy ${request.userRole.toUpperCase()} — never compare them to champions in other lanes.`
      : `The player's role is not specified. Suggest champions that fill the remaining open slots.`;

    const poolSection = poolStr
      ? `The player's champion pool (champions they play well): ${poolStr}.
When a pool champion is a strong fit, PRIORITIZE it and set "isInPool": true.`
      : `No champion pool defined. Set "isInPool": false for all suggestions.`;

    const draftContext = hasAnyPick
      ? `Analyze the role-by-role matchup table above before suggesting.`
      : `No champions have been picked yet — this is blind-pick territory.`;

    const langInstruction = this.ls.T().aiLang;

    const sideSection = request.side === 'red'
      ? `The player is on RED SIDE (picks: 2nd, 3rd, 6th, 7th, 10th overall).
RED SIDE ADVANTAGE: Last pick (#10) — can hard counter-pick the enemy's last champion. Prioritize champions that counter the enemy composition or specific threats. Flex picks and deceptive champion pools are very valuable.`
      : `The player is on BLUE SIDE (picks: 1st, 4th, 5th, 8th, 9th overall).
BLUE SIDE ADVANTAGE: First pick (#1) — sets the draft tempo. Prioritize strong, flexible champions that are difficult to counter-pick. Blind-pick-safe champions, comfort picks, and win-condition setters are ideal.`;

    return `You are an expert League of Legends coach helping a player during champion select.
${langInstruction}

=== SIDE SELECTION ===
${sideSection}

=== DRAFT (role by role) ===
${roleTable}

Ally bans:  ${allyBansStr}
Enemy bans: ${enemyBansStr}

=== MATCHUP RULE ===
Each role only faces its direct lane opponent.
TOP faces enemy TOP. JUNGLE faces enemy JUNGLE. MID faces enemy MID. ADC faces enemy ADC. SUPPORT faces enemy SUPPORT.
Never compare a champion in one role to a champion in a different role.

=== PLAYER ===
${roleSection}
${poolSection}

=== YOUR TASK ===
${draftContext}

Step 1 — Ally composition: What is the win condition or archetype? What is missing?
Step 2 — Enemy threats: What does the enemy want to do? What are their weaknesses?
Step 3 — Generate exactly 5 champion suggestions.

Rules for each suggestion reason:
- Be specific and tactical. Name champions, abilities, and mechanics.
- BAD: "Strong champion with good synergy."
- GOOD: "Orianna's Command: Protect shields Jinx from Zed's R assassination and her shockwave wins the teamfight your comp is built around."
- For blind picks (no picks yet): explain why it's safe, flexible, or hard to counter-pick.
- If a pool champion fits, prefer it and mark isInPool true.
- Include exactly 2 summoner spells suited for this champion and role (choose from: Flash, Ignite, Teleport, Ghost, Barrier, Heal, Exhaust, Cleanse, Smite).

Respond ONLY with a valid JSON array — no markdown, no text outside the JSON.
[
  {
    "championId": "Orianna",
    "championName": "Orianna",
    "reason": "Specific tactical reason here.",
    "isInPool": false,
    "summonerSpells": ["Flash", "Barrier"]
  }
]`;
  }

  private parseResponse(response: any): Suggestion[] {
    try {
      const text: string = response.choices[0].message.content;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

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
        summonerSpells: Array.isArray(item.summonerSpells) ? item.summonerSpells.slice(0, 2) : [],
      }));
    } catch {
      return [];
    }
  }
}
