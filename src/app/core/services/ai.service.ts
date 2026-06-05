import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { AIHttpService } from '@core/services/ai-http.service';
import { DraftPick, DraftRole, DraftSide, Suggestion, GameplayTip, GameplayPhase, CompSummary, ChampionTip, ChampionTipType } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';
import { LanguageService } from '@core/services/language.service';
import { TierListService, ChampionTierEntry } from '@core/services/tier-list.service';
import { MatchupService, ChampionMatchupData } from '@core/services/matchup.service';
import { PatchService } from '@core/services/patch.service';

const SPELL_ID_MAP: Record<string, string> = {
  flash: 'SummonerFlash',
  ignite: 'SummonerDot',
  teleport: 'SummonerTeleport',
  ghost: 'SummonerHaste',
  barrier: 'SummonerBarrier',
  heal: 'SummonerHeal',
  exhaust: 'SummonerExhaust',
  cleanse: 'SummonerBoost',
  smite: 'SummonerSmite',
  snowball: 'SummonerSnowball',
  mark: 'SummonerSnowball',
};

export interface DraftAnalysisRequest {
  allyPicks: DraftPick[];
  enemyPicks: DraftPick[];
  allyBans: Champion[];
  enemyBans: Champion[];
  userRole?: DraftRole;
  poolChampions?: string[];
  side?: DraftSide;
  allyCompName?: string;
  enemyCompName?: string;
}

export interface CompSummaryRequest {
  allyPicks: DraftPick[];
  enemyPicks: DraftPick[];
}

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private aiHttp = inject(AIHttpService);
  private ls = inject(LanguageService);
  private tierListService = inject(TierListService);
  private matchupService  = inject(MatchupService);
  private patchService    = inject(PatchService);

  private get ddragonBase() {
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}`;
  }

  getSpellImageUrl(spellName: string): string {
    const id = SPELL_ID_MAP[spellName.toLowerCase()] ?? `Summoner${spellName}`;
    return `${this.ddragonBase}/img/spell/${id}.png`;
  }

  analyzeDraft(request: DraftAnalysisRequest): Observable<Suggestion[]> {
    const tierFetch = request.userRole
      ? this.tierListService.getChampionTiers(request.userRole)
      : of(null);

    // Fetch real counter data for the enemy champion in the user's role
    const enemyChamp = request.userRole
      ? (request.enemyPicks.find(p => p.role === request.userRole)?.champion ?? null)
      : null;
    const matchupFetch = enemyChamp && request.userRole
      ? this.matchupService.getCounters(enemyChamp.name, request.userRole)
      : of(null as ChampionMatchupData | null);

    return tierFetch.pipe(
      switchMap((tierData) =>
        matchupFetch.pipe(
          switchMap((matchupData) => {
            const prompt = this.buildPrompt(request, tierData, matchupData);
            return this.aiHttp
              .post<any>({ messages: [{ role: 'user', content: prompt }], temperature: 0.25, max_tokens: 2200 })
              .pipe(map((res: any) => this.parseResponse(res)));
          }),
        ),
      ),
    );
  }

  private buildPrompt(
    request: DraftAnalysisRequest,
    tierData: ChampionTierEntry[] | null,
    matchupData: ChampionMatchupData | null = null,
  ): string {
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
      ? `Player role: ${request.userRole.toUpperCase()}.
All 5 suggestions MUST play ${request.userRole.toUpperCase()}.
Lane matchup: player's ${request.userRole.toUpperCase()} vs enemy ${request.userRole.toUpperCase()} only.`
      : `Role not specified. Suggest champions for open slots.`;

    const poolSection = poolStr
      ? `=== POOL REFERENCE (post-processing only — do NOT use for ranking) ===
Pool: ${poolStr}
After ranking the 5 best picks for this draft, scan this list.
For any suggestion that appears in the pool, add "In your pool ★" as the LAST pros[] entry.
It is completely correct to return 0 pool champions if the best picks don't overlap with the pool.
NEVER change the ranking order because of the pool.`
      : '';

    const sideSection =
      request.side === 'red'
        ? `RED SIDE (picks 2/3/6/7/10). Last pick = hard counter-pick opportunity.`
        : `BLUE SIDE (picks 1/4/5/8/9). First pick = set draft tempo, blind-pick-safe.`;

    const draftContext = hasAnyPick
      ? `Champions are already on the board — analyze actual synergies and matchups.`
      : `No picks yet (blind phase) — prioritize safe, flexible, hard-to-counter champions.`;

    const tierSection = this.buildTierSection(
      tierData,
      request.userRole,
      request.allyPicks,
      request.enemyPicks,
    );

    const langInstruction = this.ls.T().aiLang;
    const botlaneSection = this.buildBotlaneSection(request, allyByRole, enemyByRole);

    // Real matchup data from OP.GG — highest-value context for counter logic
    const matchupSection = this.buildMatchupSection(matchupData, request.userRole ?? null, enemyByRole);

    return `You are an elite League of Legends coach. Rank suggestions by TRUE WIN PROBABILITY in this exact game state.
${langInstruction}

=== SIDE ===
${sideSection}

=== DRAFT ===
${roleTable}
Ally bans: ${allyBansStr}
Enemy bans: ${enemyBansStr}${request.allyCompName ? `\nAlly comp: ${request.allyCompName}` : ''}${request.enemyCompName ? `\nEnemy comp: ${request.enemyCompName}` : ''}

=== PLAYER ===
${roleSection}

${matchupSection}

=== RANKING PRIORITY — follow this exact order, never deviate ===

PRIORITY 1 — COUNTER (does it hard-answer their win condition?)
Ask: How does the enemy team win? Which champion is their key threat?
Then: Does this pick directly shut it down?
${matchupSection ? '↑ Use the REAL MATCHUP DATA above as your primary counter source.' : `
FALLBACK DAMAGE TYPE RULES (use when no real data above):
Armor tanks (Malphite, Rammus) → AD melee (Jax/Darius/Nasus/Riven) are invalidated — prefer AP/ranged/poke
Assassins (Zed/Talon) vs peel comps → poor matchup — prefer poke or CC-heavy picks`}

More counter patterns:
  • Braum W blocks ALL projectiles → counters Nautilus/Blitzcrank/Thresh/Pyke hooks
  • Renekton → punishes slow starts (Nasus, Gangplank, Gnar)
  • Quicksilver Sash users → counter point-and-click CC (Warwick, Malzahar, Mordekaiser)
  • Ranged poke (Teemo, Jayce, Quinn) → neutralizes melee bullies who can't reach

PRIORITY 2 — SYNERGY (does it complete or enable an ally combo?)
Ask: Are there ally picks with combo potential that need a specific partner?
Reasoning patterns to apply:
  • Sejuani Frost passive: any 2 separate CCs hit same target = 1.5s Frozen stun.
    → Recommend CC champions that fight in same area: Renekton (W stun), Camille (E stun), Jax (E counterstrike)
  • Engage chain: Malphite/Amumu/Nautilus ult → free setup for immobile hypercarries (Jinx, Kog'Maw, Miss Fortune)
  • Yasuo/Yone ally → REQUIRE knock-up source (Malphite, Jarvan R, Orianna Q, Lee Sin R, Gragas E)
  • Vi R (suppression) → perfect Orianna shockwave target
  • No frontline in ally comp → suggest tank/bruiser before more carries
  • Full dive comp → DO NOT suggest poke; full poke comp → DO NOT suggest dive

PRIORITY 3 — LANE POWER
Direct matchup: win lane, survive, or outscale the lane opponent.

PRIORITY 4 — META STRENGTH
Tier and win rate from provided data or training knowledge of patch ${this.patchService.version()}.

${tierSection}

=== TASK ===
${draftContext}

Step 1 — Enemy win condition: how do they win? Who is the key threat?
Step 2 — Ally gaps: what is the comp missing (frontline/damage/CC/peel)?
Step 3 — Synergy check: are any ally picks creating combo potential (check Priority 2 patterns)?
Step 4 — Rank exactly 6 champion suggestions by pure draft quality (best first).
Step 5 — MANDATORY VALIDATION: for each suggestion, answer these 3 questions:
  a) Does this champion's damage type get hard-countered by any enemy champion? (e.g., AD melee vs armor tank = fail)
  b) Does this champion have a realistic way to impact the game given the enemy comp?
  c) Would a high-elo player be embarrassed to pick this here?
  If you answer YES to (a) or (c), or NO to (b) → REPLACE that suggestion immediately.
Step 6 — Pool check: scan your validated list against the pool reference below and mark matches.

${poolSection}

${botlaneSection}

=== OUTPUT FORMAT ===
Respond ONLY with a valid JSON array — no markdown, no text outside JSON.

[
  {
    "championId": "Renekton",
    "championName": "Renekton",
    "tierInfo": "A-tier · 51% WR",
    "summonerSpells": ["Flash", "Ignite"],
    "pros": [
      "Sejuani Frost + Renekton W = guaranteed 3s chain CC",
      "Destroys Nasus/Gnar in lane pre-6",
      "Ult Dominus absorbs Malphite R burst damage",
      "Shuts down Gnar before Mega form transforms"
    ],
    "cons": [
      "Falls off hard late game"
    ],
    "botlanePairs": [
      {"id": "Seraphine", "name": "Seraphine", "synergy": "Seraphine E roots auto-trigger on Ashe Frost-slowed targets"},
      {"id": "Lux", "name": "Lux", "synergy": "Lux Q pins enemies onto Caitlyn Yordle Snap Trap for headshot proc"}
    ]
  }
]

STRICT RULES:
— "tierInfo": tier + WR in a compact badge ("S-tier · 53% WR"). Use training knowledge if no live data. Never empty string — always provide a tier estimate.
— pros[]: 3–4 entries of PURE TACTICAL reasons — counters, synergies, lane matchup advantages, teamfight role. NEVER put tier/WR in pros.
— Each pros/cons entry: 3–9 words, punchy phrase, NOT a full sentence
— cons[]: 0–2 entries — only genuine weaknesses vs THIS specific draft. Leave [] if strong fit.
— botlanePairs[]: populated only when role is ADC or SUPPORT (otherwise [])
— botlanePairs[].synergy: 8-18 words. Explain the SPECIFIC mechanical synergy between the two champions.
  Name abilities by their button letter or full name. Focus on: ability interactions, level spikes, bush control, kill windows.
  GOOD: "Seraphine E roots auto-trigger on Ashe Frost-slowed targets"
  GOOD: "Lux Q pins enemies onto Caitlyn Yordle Snap Trap for headshot proc"
  GOOD: "Nautilus hook chains into Samira melee range for guaranteed R activation"
  GOOD: "Both have strong level 2 — shove and dive at first opportunity"
  BAD:  "Good synergy and strong together"
— BAD pro: "Strong pick with great teamfight synergy and good damage output."
— GOOD pro: "Sejuani Frost + Renekton W = 3s chain CC"
— Summoner spells: exactly 2. Follow these role conventions strictly:
  TOP:     Flash+Teleport (default), Flash+Ignite (kill-threat tops: Darius, Garen, Fiora), Flash+Ghost (some fighters)
  JUNGLE:  Flash+Smite or Ghost+Smite — ALWAYS Smite. Never skip Smite for jungle.
  MID:     Flash+Ignite (assassins, aggressive mages), Flash+Barrier (immobile mages vs assassins), Flash+Teleport (scaling mages like Orianna, Viktor)
  ADC:     Flash+Heal (standard), Flash+Cleanse (vs heavy CC), Ghost+Heal (hypercarries like Jinx, Kog'Maw)
  SUPPORT: Flash+Exhaust (default for most supports), Flash+Ignite (aggressive engage supports: Leona, Nautilus, Brand, Lux), Flash+Barrier (enchanters: Lulu, Soraka, Janna)
  NEVER give Smite to non-jungle. NEVER give Teleport to ADC/Support.`;
  }

  private buildMatchupSection(
    matchupData: ChampionMatchupData | null,
    userRole: DraftRole | null,
    enemyByRole: Map<DraftRole, string | undefined>,
  ): string {
    if (!matchupData || !userRole) return '';

    const enemyName = enemyByRole.get(userRole) ?? matchupData.champion;
    const topCounters = matchupData.counters
      .slice(0, 6)
      .map(c => `${c.name} (${c.winRate}% WR)`)
      .join(' | ');

    return `=== REAL MATCHUP DATA — OP.GG Ranked Stats (HIGHEST PRIORITY) ===
Enemy ${enemyName.toUpperCase()} (${userRole.toUpperCase()}): primary damage type = ${matchupData.damageType}
Champions that BEAT ${enemyName} in lane (real win rates, current patch):
  ${topCounters}

HARD RULE: Suggestions must come from this list or have a clear tactical justification.
Champions NOT on this list are statistically poor picks vs ${enemyName}.
Damage type ${matchupData.damageType} means: ${
  matchupData.damageType === 'AP' ? 'AD melees (Jax/Darius/Nasus/Riven) deal drastically reduced damage — DO NOT suggest them' :
  matchupData.damageType === 'AD' ? 'AP squishies without mobility struggle — consider AP tanks or assassins with gapclosers' :
  'mixed damage — evaluate each suggestion individually'
}.`;
  }

  private buildBotlaneSection(
    request: DraftAnalysisRequest,
    allyByRole: Map<DraftRole, string | undefined>,
    enemyByRole: Map<DraftRole, string | undefined>,
  ): string {
    const role = request.userRole;
    if (role !== 'adc' && role !== 'support') return '';

    const allyAdc = allyByRole.get('adc') ?? '(open)';
    const allySupport = allyByRole.get('support') ?? '(open)';
    const enemyAdc = enemyByRole.get('adc') ?? '(open)';
    const enemySupport = enemyByRole.get('support') ?? '(open)';

    const partnerRole = role === 'adc' ? 'SUPPORT' : 'ADC';
    const partnerInstruction =
      role === 'adc'
        ? `You are the ADC. For each suggested ADC, provide 2–3 supports that maximize that ADC's strengths.
  Consider: Does this ADC need engage (Leona/Nautilus), peel (Lulu/Janna), or poke (Xerath/Zyra)?
  Consider enemy support: aggressive enemy support → prefer disengage/peel; passive → prefer all-in.`
        : `You are the SUPPORT. For each suggested support, provide 2–3 ADCs this support enables best.
  Consider: Does this support want an early-kill ADC (Draven/Lucian), a scaling hypercarry (Jinx/Kog'Maw), or a poke ADC (Ezreal/Caitlyn)?
  Consider enemy ADC: tanky enemy ADC → prefer poke/burst partner; squishy → all-in.`;

    return `=== BOTLANE PAIRINGS ===
Role is ${role.toUpperCase()} — add "botlanePairs" for each suggestion.
${partnerInstruction}

Botlane context:
  Ally ADC: ${allyAdc} | Ally Support: ${allySupport}
  Enemy ADC: ${enemyAdc} | Enemy Support: ${enemySupport}

Return 2–3 ${partnerRole} champions per suggestion.
Format: "botlanePairs": [{"id": "Thresh", "name": "Thresh", "synergy": "Hook into lantern save enables aggressive tower dives"}, ...]
IDs must be valid DDragon format: no spaces (LeeSin, AurelionSol, Kaisa, JarvanIV).
Each "synergy": 8-18 words, name specific abilities/mechanics (e.g. "Lux Q roots onto Caitlyn traps for guaranteed headshot").
`;
  }

  private buildTierSection(
    tierData: ChampionTierEntry[] | null,
    userRole: DraftRole | undefined,
    allyPicks: DraftPick[],
    enemyPicks: DraftPick[],
  ): string {
    if (!tierData || tierData.length === 0) {
      return `=== TIER DATA ===
No live tier data available.
For every suggestion, fill the "tierInfo" field with the champion's approximate tier and win rate from your training knowledge of patch ${this.patchService.version()}.
Format: "A-tier · ~51% WR" or "S-tier · 53% WR". Do NOT put tier/WR inside pros[].`;
    }

    const takenNames = new Set([
      ...allyPicks.filter((p) => p.champion).map((p) => p.champion!.name),
      ...enemyPicks.filter((p) => p.champion).map((p) => p.champion!.name),
    ]);

    const lines = tierData
      .filter((e) => !takenNames.has(e.name))
      .slice(0, 25)
      .map((e) => {
        const wr = e.winRate != null ? ` · ${(e.winRate * 100).toFixed(1)}% WR` : '';
        const pr = e.pickRate != null ? ` · ${(e.pickRate * 100).toFixed(1)}% PR` : '';
        const tier = e.tier ? `${e.tier}-tier` : '';
        return `  ${e.name.padEnd(18)} ${tier}${wr}${pr}`;
      })
      .join('\n');

    const roleLabel = userRole ? userRole.toUpperCase() : 'this role';
    return `=== TIER LIST (OP.GG Platinum+, patch ${this.patchService.version()} — ${roleLabel}) ===
${lines}

Use this data: put tier + WR in the "tierInfo" field (e.g. "A-tier · 51.8% WR"). Do NOT put it in pros[].`;
  }

  private parseResponse(response: any): Suggestion[] {
    try {
      const text: string = response.choices[0].message.content;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return parsed.map((item: any) => {
        // Sanitize ID to DDragon format: "Miss Fortune" → "MissFortune", "K'Sante" → "KSante"
        const champId = String(item.championId ?? '').trim().replace(/['\s`]/g, '');
        return {
          champion: {
            id: champId,
            name: item.championName,
            title: '',
            image: `${this.ddragonBase}/img/champion/${champId}.png`,
            tags: [],
          },
          isInPool: false,
          tierInfo: String(item.tierInfo ?? '').trim(),
          summonerSpells: Array.isArray(item.summonerSpells) ? item.summonerSpells.slice(0, 2) : [],
          pros: Array.isArray(item.pros) ? item.pros.slice(0, 4) : [],
          cons: Array.isArray(item.cons) ? item.cons.slice(0, 2) : [],
          botlanePairs: Array.isArray(item.botlanePairs)
            ? item.botlanePairs
                .slice(0, 3)
                .map((p: any) => ({
                  id: String(p.id ?? p.championId ?? '').trim(),
                  name: String(p.name ?? p.championName ?? '').trim(),
                  synergy: String(p.synergy ?? '').trim(),
                }))
                .filter((p: { id: string; name: string }) => p.id && p.name)
            : [],
        };
      });
    } catch {
      return [];
    }
  }

  // ── Gameplay tips (triggered when all 10 picks are locked) ──────────────

  analyzeGameplay(request: GameplayRequest): Observable<GameplayTip[]> {
    const prompt = this.buildGameplayPrompt(request);
    return this.aiHttp
      .post<any>({ messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 1400 })
      .pipe(map((res: any) => this.parseGameplayResponse(res)));
  }

  private buildGameplayPrompt(request: GameplayRequest): string {
    const { allyPicks, enemyPicks, userRole, side } = request;
    const allyMap = new Map(allyPicks.map((p) => [p.role, p.champion?.name ?? '(open)']));
    const enemyMap = new Map(enemyPicks.map((p) => [p.role, p.champion?.name ?? '(open)']));
    const roles: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

    const playerChamp = allyMap.get(userRole) ?? '(unknown)';
    const enemyChamp = enemyMap.get(userRole) ?? '(unknown)';
    const allyStr = roles.map((r) => `${r}: ${allyMap.get(r)}`).join(', ');
    const enemyStr = roles.map((r) => `${r}: ${enemyMap.get(r)}`).join(', ');
    const langInstruction = this.ls.T().aiLang;

    return `You are an expert League of Legends coach giving hyper-specific pre-game advice.
${langInstruction}

PLAYER: ${playerChamp.toUpperCase()} (${userRole.toUpperCase()} — ${side.toUpperCase()} SIDE)
LANE OPPONENT: ${enemyChamp.toUpperCase()}
ALLY TEAM: ${allyStr}
ENEMY TEAM: ${enemyStr}

Generate 6-8 concrete gameplay tips for this exact matchup and draft.
Each tip MUST reference specific champion names, ability names, or mechanics — no generic advice.

Phases to cover (use exactly these phase keys):
  "early"     — levels 1-6: wave state, first back timing, level 2/3/6 spike, jungle tracking
  "trade"     — trading pattern: when to engage, ability order, short vs extended trades
  "teamfight" — positioning, target priority, ability usage in 5v5 given these two comps
  "win"       — the specific path to victory: when/how this comp closes the game
  "danger"    — the single biggest threat to respect and exactly how to deal with it

Rules:
  — Each tip: maximum 15 words, punchy and direct
  — Reference ability names when relevant (e.g. "Sejuani Frozen Stasis", "Renekton W stun")
  — Include numbers when helpful ("level 2", "pre-6", "3 items")
  — Cover at least 1 tip for each phase

Example good tips (for Renekton vs Nasus):
  {"phase":"early","tip":"Push hard levels 1-5 — Nasus has no kill threat before Wither (W)"}
  {"phase":"trade","tip":"All-in at level 2 with W stun before Nasus stacks — you win hard"}
  {"phase":"danger","tip":"Respect his Wither (W) at level 6 — it halves your attack speed"}

Respond ONLY with a valid JSON array, no markdown.
[{"phase":"early","tip":"..."},...]`;
  }

  private parseGameplayResponse(response: any): GameplayTip[] {
    const VALID_PHASES = new Set<GameplayPhase>(['early', 'trade', 'teamfight', 'win', 'danger']);
    try {
      const text: string = response.choices[0].message.content;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return (parsed as any[])
        .filter((item) => item?.phase && item?.tip)
        .slice(0, 8)
        .map((item) => ({
          phase: (VALID_PHASES.has(item.phase) ? item.phase : 'early') as GameplayPhase,
          tip: String(item.tip).slice(0, 120),
        }));
    } catch {
      return [];
    }
  }

  // ── Comp summary ─────────────────────────────────────────────────────────

  analyzeCompSummary(request: CompSummaryRequest): Observable<CompSummary> {
    const prompt = this.buildCompSummaryPrompt(request);
    return this.aiHttp
      .post<any>({ messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 600 })
      .pipe(map((res: any) => this.parseCompSummaryResponse(res)),
      );
  }

  private buildCompSummaryPrompt(request: CompSummaryRequest): string {
    const roles: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];
    const fmt = (picks: DraftPick[]) =>
      roles.map((r) => {
        const c = picks.find((p) => p.role === r)?.champion?.name;
        return c ? `${r}: ${c}` : null;
      }).filter(Boolean).join(' | ');

    const allyStr  = fmt(request.allyPicks)  || '(no picks yet)';
    const enemyStr = fmt(request.enemyPicks) || '(no picks yet)';
    const langInstruction = this.ls.T().aiLang;

    return `You are a League of Legends draft analyst.
${langInstruction}

ALLY: ${allyStr}
ENEMY: ${enemyStr}

Identify each team's composition archetype and give strategic advice.

Respond ONLY with valid JSON — no markdown:
{
  "allyCompName": "short iconic name (2-4 words, e.g. Triple Engage, Protect the Carry, Poke Siege, Early Snowball, Wombo Combo, Splitpush)",
  "enemyCompName": "short iconic name (2-4 words)",
  "macroTips": [
    "actionable strategic tip (8-15 words)",
    "...",
    "..."
  ]
}

Rules for macroTips (3-4 items):
— WHEN to fight: early or late? why?
— WHICH objectives: dragon? baron? herald? split?
— ONE specific threat to play around
— Action-oriented: "Invade early before...", "Force fights at...", "Avoid..."
— Specific to THESE two comps, not generic`;
  }

  private parseCompSummaryResponse(response: any): CompSummary {
    try {
      const text: string = response.choices[0].message.content;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        allyCompName: String(parsed.allyCompName ?? '').trim(),
        enemyCompName: String(parsed.enemyCompName ?? '').trim(),
        macroTips: Array.isArray(parsed.macroTips)
          ? parsed.macroTips.slice(0, 4).map((t: unknown) => String(t).trim())
          : [],
      };
    } catch {
      return { allyCompName: '', enemyCompName: '', macroTips: [] };
    }
  }

  // ── Champion tips (niche mechanics + synergies for the user's picked champ) ─

  analyzeChampionTips(request: ChampionTipsRequest): Observable<ChampionTip[]> {
    const prompt = this.buildChampionTipsPrompt(request);
    return this.aiHttp
      .post<any>({ messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 900 })
      .pipe(map((res: any) => this.parseChampionTipsResponse(res)));
  }

  private buildChampionTipsPrompt(request: ChampionTipsRequest): string {
    const { champion, role, allyPicks, enemyPicks } = request;
    const roles: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

    const allyMap = new Map(allyPicks.map((p) => [p.role, p.champion?.name]));
    const enemyMap = new Map(enemyPicks.map((p) => [p.role, p.champion?.name]));

    const allyStr = roles.map((r) => allyMap.get(r) ?? '(open)').filter(n => n !== '(open)').join(', ') || 'none yet';
    const enemyStr = roles.map((r) => enemyMap.get(r) ?? '(open)').filter(n => n !== '(open)').join(', ') || 'none yet';

    const langInstruction = this.ls.T().aiLang;

    return `You are an expert League of Legends coach. A player just picked ${champion.name.toUpperCase()} for ${role.toUpperCase()}.
${langInstruction}

Their team: ${allyStr}
Enemy team: ${enemyStr}

Give 5-6 NICHE tips that only mains of ${champion.name} would know. Focus on:
  "mechanic"    — hidden or non-obvious ability interaction unique to this champion
  "synergy"     — specific ability combo with a CURRENT ally (name the ally and their ability)
  "combo"       — key ability sequence or timing for maximum effectiveness
  "counterplay" — a specific enemy threat in this draft and exactly how to play around it

EXAMPLES of good tips:
  mechanic:    "Cassio E (Twin Fang) costs 0 mana and heals more when hitting a poisoned target"
  synergy:     "Ashe W slows → Seraphine E auto-roots without channeling — use in lane for free CC chain"
  combo:       "W → Q → E spam — Q applies Noxious Blast for 3s, E only costs mana when it hits poisoned"
  counterplay: "Zed R: keep Zhonya's off cooldown, activate when he lands behind you (before autos)"

RULES:
— Each tip: 12-20 words, specific to ${champion.name}'s actual kit and abilities
— Synergy tips MUST name a specific current ally champion and their ability
— If fewer than 2 allies are picked, skip synergy tips and focus on mechanics/combos
— NO generic advice ("play safe", "ward", "farm")
— Reference ability names (Q/W/E/R or ability name)

Respond ONLY with valid JSON — no markdown:
[{"type":"mechanic","tip":"..."},{"type":"synergy","tip":"..."}]`;
  }

  private parseChampionTipsResponse(response: any): ChampionTip[] {
    const VALID: Set<ChampionTipType> = new Set(['mechanic', 'synergy', 'combo', 'counterplay']);
    try {
      const text: string = response.choices[0].message.content;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return (parsed as any[])
        .filter((item) => item?.type && item?.tip && VALID.has(item.type))
        .slice(0, 6)
        .map((item) => ({
          type: item.type as ChampionTipType,
          tip: String(item.tip).trim().slice(0, 150),
        }));
    } catch {
      return [];
    }
  }
}

export interface ChampionTipsRequest {
  champion: Champion;
  role: DraftRole;
  allyPicks: DraftPick[];
  enemyPicks: DraftPick[];
}

export interface GameplayRequest {
  allyPicks: DraftPick[];
  enemyPicks: DraftPick[];
  userRole: DraftRole;
  side: DraftSide;
}
