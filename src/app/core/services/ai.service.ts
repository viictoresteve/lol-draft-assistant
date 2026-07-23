import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { switchMap, map, catchError, shareReplay } from 'rxjs/operators';
import { AIHttpService } from '@core/services/ai-http.service';
import { DraftPick, DraftRole, DraftSide, Suggestion, GameplayTip, GameplayPhase, CompSummary, ChampionTip, ChampionTipType } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';
import { LanguageService } from '@core/services/language.service';
import { TierListService, ChampionTierEntry } from '@core/services/tier-list.service';
import { MatchupService, ChampionMatchupData } from '@core/services/matchup.service';
import { PatchService } from '@core/services/patch.service';
import { ChampionDetailService } from '@core/services/champion-detail.service';
import { BuildService, ChampionBuild } from '@core/services/build.service';
import { AbilityInfo } from '@features/ability-quiz/models/ability-quiz.interface';
import {
  DraftPuzzle, PuzzleAnswer, PuzzleDifficulty, PickGrade,
} from '@features/puzzle/models/puzzle.interface';

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

/** OpenAI-compatible chat completion envelope returned by all AI providers */
interface AiChatResponse {
  choices?: { message?: { content?: string } }[];
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
  private detailService   = inject(ChampionDetailService);
  private buildService    = inject(BuildService);

  /**
   * In-memory cache of AI responses keyed by the exact prompt, so identical
   * draft states (re-renders, language toggles, repeated effect triggers) don't
   * burn rate-limited API calls. Short TTL keeps results fresh.
   */
  private promptCache = new Map<string, { obs: Observable<unknown>; expires: number }>();
  private static readonly CACHE_TTL_MS = 3 * 60 * 1000;

  /** Run an AI call through the prompt cache (dedup + short-lived reuse). */
  private cached<T>(prompt: string, factory: () => Observable<T>): Observable<T> {
    const now = Date.now();
    const hit = this.promptCache.get(prompt);
    if (hit && hit.expires > now) return hit.obs as Observable<T>;

    const obs: Observable<T> = factory().pipe(
      // Never cache failures — evict so a retry makes a fresh call
      catchError((err) => { this.promptCache.delete(prompt); return throwError(() => err); }),
      shareReplay(1),
    );
    this.promptCache.set(prompt, { obs, expires: now + AiService.CACHE_TTL_MS });

    // Opportunistic cleanup of expired entries
    if (this.promptCache.size > 50) {
      for (const [k, v] of this.promptCache) if (v.expires <= now) this.promptCache.delete(k);
    }
    return obs;
  }

  /**
   * Shared expert persona + global rules applied to EVERY AI call (draft,
   * puzzle, tips, comp…) so quality and behaviour are consistent everywhere.
   * Sent as the `system` message; each feature adds its own `user` prompt.
   */
  private systemPrompt(): string {
    return `You are an elite, Challenger-level League of Legends analyst and coach on patch ${this.patchService.version()}, with deep, current knowledge of champions, abilities, items, runes and the live competitive meta.
${this.ls.T().aiLang}

GLOBAL RULES — follow on every response:
1. GROUND TRUTH: any DATA given in the prompt (tier lists, win rates, matchup counters, champion kits, champion classes) overrides your own memory. Trust it over your recollection.
2. NEVER invent champions, abilities, items or statistics. If you are not sure something is real, stay general instead of fabricating a specific claim.
3. BE SPECIFIC: name exact champions, abilities (by slot letter + name) and mechanics. Cite the concrete reason. No filler, no hedging, no generic advice ("play safe", "ward", "farm").
4. Reason from the ACTUAL game state given — the specific picks, bans, role and matchup in THIS prompt, not a generic template.
5. Output MUST be valid JSON matching the requested schema exactly — no markdown fences, no prose outside the JSON.`;
  }

  /** Build the chat messages: shared system persona + the feature's user prompt. */
  private msgs(prompt: string): { role: 'system' | 'user'; content: string }[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: prompt },
    ];
  }

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
            return this.cached(prompt, () => this.aiHttp
              .post<AiChatResponse>({ messages: this.msgs(prompt), temperature: 0.25, max_tokens: 2200 })
              .pipe(map((res) => this.parseResponse(res))));
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

    // Factual champion classes (from Riot tags) — anchors the model so it can't
    // misremember a champion's identity (e.g. treat a mage as an AD bruiser).
    const classRef = [...request.allyPicks, ...request.enemyPicks]
      .map((p) => p.champion)
      .filter((c): c is NonNullable<typeof c> => !!c && Array.isArray(c.tags) && c.tags.length > 0)
      .map((c) => `${c.name} (${c.tags.join('/')})`)
      .join(' · ');
    const classSection = classRef ? `\n=== CHAMPION CLASSES (factual, Riot data) ===\n${classRef}` : '';

    // Aggregate the ENEMY composition into a factual profile the pick must answer.
    // This is the key signal that makes suggestions vary with the enemy comp
    // (instead of collapsing to the same tier-list picks every time).
    const enemyProfileSection = this.buildEnemyProfile(request.enemyPicks);

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
All 6 suggestions MUST play ${request.userRole.toUpperCase()}.
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
${classSection}
${enemyProfileSection}

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
Respond ONLY with a valid JSON object — no markdown, no text outside JSON.
Return a top-level object with a "suggestions" array:

{
  "suggestions": [
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
}

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
— Summoner spells: exactly 2. These are SENSIBLE DEFAULTS by role, not hard rules — the meta shifts and off-meta/flex choices are valid when they fit the pick and matchup:
  TOP:     usually Flash+Teleport; Flash+Ignite on kill-threat tops (Darius, Garen, Fiora); Flash+Ghost on some fighters
  JUNGLE:  Flash+Smite or Ghost+Smite — Smite is effectively required for the jungle item, so keep it
  MID:     Flash+Ignite (assassins, aggressive mages); Flash+Barrier (immobile mages vs assassins); Flash+Teleport (scaling mages like Orianna, Viktor)
  ADC:     usually Flash+Heal; Flash+Cleanse vs heavy CC; Ghost+Heal on hypercarries — and Teleport DOES see play on some ADCs (side-lane/scaling styles), so don't rule it out if it suits the pick
  SUPPORT: usually Flash+Exhaust; Flash+Ignite on aggressive engage (Leona, Nautilus, Pyke); Flash+Barrier on enchanters — supports can also run Teleport (e.g. via the summoner-swap rune) when it helps the comp
  Pick what genuinely fits THIS champion + matchup this patch. When unsure, prefer the common choice, but never force a spell that's clearly wrong for the pick.`;
  }

  /**
   * Aggregate the enemy team into a factual damage/threat profile from Riot
   * class tags. This is the signal that forces suggestions to actually adapt to
   * the enemy comp instead of returning the same tier-list picks every time.
   */
  private buildEnemyProfile(enemyPicks: DraftPick[]): string {
    const champs = enemyPicks
      .map((p) => p.champion)
      .filter((c): c is NonNullable<typeof c> => !!c && Array.isArray(c.tags) && c.tags.length > 0);
    if (champs.length < 2) return ''; // need a couple of picks to profile a comp

    const names = (pred: (tags: string[]) => boolean) =>
      champs.filter((c) => pred(c.tags)).map((c) => c.name);

    // Rough damage lean from tags (imperfect but factual enough to steer ranking).
    const adLeaning = names((t) => t.includes('Marksman') || t.includes('Fighter'));
    const apLeaning = names((t) => t.includes('Mage'));
    const assassins = names((t) => t.includes('Assassin'));
    const tanks = names((t) => t.includes('Tank'));
    const marksmen = names((t) => t.includes('Marksman'));

    const lines: string[] = [];
    lines.push(`Damage lean: ~${adLeaning.length} AD-leaning (${adLeaning.join(', ') || '—'}) vs ~${apLeaning.length} AP (${apLeaning.join(', ') || '—'})`);
    if (assassins.length) lines.push(`Burst/assassin threat: ${assassins.join(', ')} → value peel, tankiness, Zhonya's, QSS`);
    if (tanks.length) lines.push(`Frontline / engage: ${tanks.join(', ')} → value %-HP damage, kiting, disengage`);
    if (marksmen.length) lines.push(`Sustained DPS: ${marksmen.join(', ')} → value burst, dive, or hard peel`);

    return `\n=== ENEMY COMP PROFILE (factual — your pick MUST answer THIS specific comp) ===
${lines.join('\n')}
ADAPT THE RANKING: mostly AD → armor/AP picks rise; mostly AP → MR / magic-resist bruisers rise; heavy burst → durable & self-peel picks rise; heavy poke → sustain/all-in rise; heavy engage → disengage/flex rise.
Two DIFFERENT enemy comps must produce DIFFERENT top suggestions — never return the generic tier-list order when the enemy has committed picks.`;
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

  /** Safely extract + de-fence the JSON text from an AI chat response */
  private content(res: AiChatResponse): string {
    const raw = res?.choices?.[0]?.message?.content ?? '';
    return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }

  private parseResponse(res: AiChatResponse): Suggestion[] {
    try {
      const cleaned = this.content(res);
      const parsed = JSON.parse(cleaned);
      // Accept a raw array or a { suggestions: [...] } wrapper (JSON-mode safe)
      const items: any[] = Array.isArray(parsed) ? parsed : (parsed.suggestions ?? parsed.picks ?? []);

      return items.map((item: any) => {
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
    return this.cached(prompt, () => this.aiHttp
      .post<AiChatResponse>({ messages: this.msgs(prompt), temperature: 0.4, max_tokens: 1400 })
      .pipe(map((res) => this.parseGameplayResponse(res))));
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

Respond ONLY with a valid JSON object, no markdown:
{"tips":[{"phase":"early","tip":"..."}, ...]}`;
  }

  private parseGameplayResponse(res: AiChatResponse): GameplayTip[] {
    const VALID_PHASES = new Set<GameplayPhase>(['early', 'trade', 'teamfight', 'win', 'danger']);
    try {
      const cleaned = this.content(res);
      const parsed = JSON.parse(cleaned);
      const items: any[] = Array.isArray(parsed) ? parsed : (parsed.tips ?? []);
      return items
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
    return this.cached(prompt, () => this.aiHttp
      .post<AiChatResponse>({ messages: this.msgs(prompt), temperature: 0.3, max_tokens: 600 })
      .pipe(map((res) => this.parseCompSummaryResponse(res))));
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

  private parseCompSummaryResponse(res: AiChatResponse): CompSummary {
    try {
      const cleaned = this.content(res);
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
    // Ground the tips in the champion's REAL kit (Riot data) AND real OP.GG
    // build so combo/spike advice matches the actual skill order and items,
    // instead of the model hallucinating from memory.
    return forkJoin([
      this.detailService.getAbilities(request.champion.id).pipe(catchError(() => of([] as AbilityInfo[]))),
      this.buildService.getBuild(request.champion.name, request.role),
    ]).pipe(
      switchMap(([abilities, build]) => {
        const prompt = this.buildChampionTipsPrompt(request, abilities, build);
        return this.cached(prompt, () => this.aiHttp
          .post<AiChatResponse>({ messages: this.msgs(prompt), temperature: 0.35, max_tokens: 900 })
          .pipe(map((res) => this.parseChampionTipsResponse(res))));
      }),
    );
  }

  private buildChampionTipsPrompt(request: ChampionTipsRequest, abilities: AbilityInfo[], build: ChampionBuild | null): string {
    const { champion, role, allyPicks, enemyPicks } = request;
    const roles: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

    const allyMap = new Map(allyPicks.map((p) => [p.role, p.champion?.name]));
    const enemyMap = new Map(enemyPicks.map((p) => [p.role, p.champion?.name]));

    const allyStr = roles.map((r) => allyMap.get(r) ?? '(open)').filter(n => n !== '(open)').join(', ') || 'none yet';
    const enemyStr = roles.map((r) => enemyMap.get(r) ?? '(open)').filter(n => n !== '(open)').join(', ') || 'none yet';

    // Real kit block — the single biggest accuracy lever for these tips.
    const kitSection = abilities.length
      ? `=== ${champion.name.toUpperCase()}'S REAL KIT (from Riot data — use these EXACT abilities, do not invent) ===
${abilities.map((a) => `  ${a.slot} — ${a.name}: ${a.description.replace(/\s+/g, ' ').trim().slice(0, 160)}`).join('\n')}`
      : `(Kit data unavailable — rely on your knowledge of ${champion.name}, but never invent abilities.)`;

    // Real OP.GG build — grounds combo/spike/timing advice in the actual meta build.
    const buildSection = build
      ? `=== ${champion.name.toUpperCase()}'S REAL BUILD (OP.GG this patch — reference for combos & power spikes) ===
Skill max order: ${build.skillOrder.join(' > ') || 'n/a'}
Core items: ${build.coreItems.map((i) => i.name).join(' → ') || 'n/a'}
Keystone: ${build.runes.keystone || 'n/a'}   Summoners: ${build.summonerSpells.map((s) => s.name).join(' + ') || 'n/a'}`
      : '';

    const langInstruction = this.ls.T().aiLang;

    return `You are a Challenger-level ${champion.name} main coaching a player who just locked ${champion.name.toUpperCase()} into ${role.toUpperCase()}.
${langInstruction}

${kitSection}
${buildSection}

Ally team: ${allyStr}
Enemy team: ${enemyStr}

Give 5-6 NICHE, high-value tips that separate a one-trick from a first-timer. Every tip must be
concrete and actionable THIS game. Types:
  "mechanic"    — a hidden/non-obvious interaction in the kit above (animation cancel, buffered cast, damage breakpoint, resource quirk)
  "synergy"     — a specific ability combo with a NAMED current ally and their ability (only if it genuinely exists)
  "combo"       — the optimal ability sequence / cast order for a kill or trade, in ${champion.name}'s real kit
  "counterplay" — a specific enemy in THIS draft and the exact mechanic to respect (name the enemy + their ability + your answer)

GOOD examples:
  mechanic:    "Riven Q3 knock-up can be animation-cancelled into auto → R for a full burst weave"
  synergy:     "Yasuo — his knock-up on any enemy lets you flay-combo them mid-air before they land"
  combo:       "E in → Q3 knock-up → auto → R → Q reset for the execute once they drop below 50%"
  counterplay: "Malphite R: bait it with a fake all-in, then re-engage on the 100s cooldown window"

RULES:
— 12-22 words each; reference the ability by its slot letter AND name from the kit above.
— Synergy tips MUST name a real current ally (from the list) — if fewer than 2 allies exist, give more mechanics/combos instead.
— counterplay MUST name a real enemy from the list when the enemy team is non-empty.
— NO filler ("play safe", "ward", "farm well", "poke them"). Every tip teaches something specific.
— Never invent abilities, items or numbers you're unsure of.

Respond ONLY with a valid JSON object — no markdown:
{"tips":[{"type":"mechanic","tip":"..."},{"type":"synergy","tip":"..."}]}`;
  }

  private parseChampionTipsResponse(res: AiChatResponse): ChampionTip[] {
    const VALID = new Set<ChampionTipType>(['mechanic', 'synergy', 'combo', 'counterplay']);
    try {
      const cleaned = this.content(res);
      const parsed = JSON.parse(cleaned);
      const items: any[] = Array.isArray(parsed) ? parsed : (parsed.tips ?? []);
      return items
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

  // ── Draft Puzzle game ──────────────────────────────────────────────────────

  generatePuzzle(difficulty: PuzzleDifficulty, role: DraftRole): Observable<DraftPuzzle | null> {
    const prompt = this.buildPuzzlePrompt(difficulty, role);
    return this.aiHttp
      .post<AiChatResponse>({ messages: this.msgs(prompt), temperature: 0.9, max_tokens: 2400 })
      .pipe(
        map((res) => this.parsePuzzleResponse(res, difficulty, role)),
        switchMap((puzzle) => (puzzle ? this.enrichPuzzleWithRealData(puzzle) : of(null))),
      );
  }

  /**
   * Validate + enrich the puzzle with real OP.GG data:
   *  1. Filter the answer key to champions ACTUALLY played in the missing role
   *     (kills wrong-role picks like Sona-mid).
   *  2. Reject the puzzle if the enemy laner isn't a real champion for that role.
   *  3. Attach real lane-counter win rates.
   * Returns null when the puzzle is unsalvageable (caller auto-retries).
   */
  private enrichPuzzleWithRealData(puzzle: DraftPuzzle): Observable<DraftPuzzle | null> {
    const oppPicks = puzzle.missingTeam === 'ally' ? puzzle.enemyPicks : puzzle.allyPicks;
    const enemyLaner = oppPicks.find((p) => p.role === puzzle.missingRole)?.champion;

    const tierFetch = this.tierListService.getChampionTiers(puzzle.missingRole);
    const counterFetch = enemyLaner
      ? this.matchupService.getCounters(enemyLaner.name, puzzle.missingRole)
      : of(null);

    return forkJoin([tierFetch, counterFetch]).pipe(
      map(([tierList, data]: [ChampionTierEntry[] | null, ChampionMatchupData | null]) => {
        const norm = (s: string) => s.toLowerCase().replace(/['\s.]/g, '');

        // 1) Real role membership: which champions actually play this role
        let answers = puzzle.answers;
        if (tierList && tierList.length > 0) {
          const validRole = new Set(tierList.map((t) => norm(t.name)));

          // Reject if the enemy laner isn't a real champion for this role → broken puzzle
          if (enemyLaner && !validRole.has(norm(enemyLaner.name))) return null;

          answers = answers.filter(
            (a) => validRole.has(norm(a.championName)) || validRole.has(norm(a.championId)),
          );
          // Need at least one strong, valid answer left
          if (!answers.some((a) => a.grade === 'perfect' || a.grade === 'great')) return null;
        }

        // 2) Enrich with real counter win rates
        if (data) {
          const wrByName = new Map(data.counters.map((c) => [norm(c.name), c.winRate]));
          answers = answers.map((a) => {
            const wr = wrByName.get(norm(a.championId)) ?? wrByName.get(norm(a.championName));
            return wr != null ? { ...a, realWinRate: wr } : a;
          });
        }

        return {
          ...puzzle,
          answers,
          enemyLaner: enemyLaner?.name,
          enemyDamageType: data?.damageType,
          realCounters: data?.counters.map((c) => ({ name: c.name, winRate: c.winRate })),
        } as DraftPuzzle;
      }),
      catchError(() => of(puzzle)),
    );
  }

  /** Grade a champion that is NOT already in the puzzle's answer key */
  gradePick(puzzle: DraftPuzzle, championName: string): Observable<PuzzleAnswer> {
    const prompt = this.buildGradePrompt(puzzle, championName);
    return this.aiHttp
      .post<AiChatResponse>({ messages: this.msgs(prompt), temperature: 0.2, max_tokens: 300 })
      .pipe(map((res) => this.parseGradeResponse(res, championName)));
  }

  private buildPuzzlePrompt(difficulty: PuzzleDifficulty, role: DraftRole): string {
    const patch = this.patchService.version();
    const langInstruction = this.ls.T().aiLang;
    const ROLE = role.toUpperCase();

    const difficultyGuide = {
      easy: 'EASY: the correct answer is obvious — a glaring unmet need (no frontline and only tanks fit) or an obvious hard counter. A beginner should spot it.',
      medium: 'MEDIUM: requires reading both comps and the lane matchup. Several reasonable picks, but a clear best one.',
      hard: 'HARD: subtle — flex picks, win-condition nuance, or a counter to a specific carry threat. Multiple traps that look correct.',
    }[difficulty];

    return `You are a League of Legends draft-puzzle designer for a training game. Patch ${patch}.
${langInstruction}

Create a REALISTIC ranked draft where the player's ${ROLE} pick is missing and there is a clearly BEST champion to fill it.
The missing slot is ALWAYS the player's own team (ally) in the ${ROLE} role. Make every puzzle DIFFERENT — vary champions, bans, scenario type and side. Do NOT reuse a template.

DESIGN RULES:
- The missing role is ${ROLE}. The ally team has 4 champions (NO ${ROLE}). The enemy team has all 5 (including their ${ROLE} laner so a real lane matchup exists).
- Use only real champions valid for the current meta.
- Each team has exactly 5 bans (realistic, high-priority bans). No champion appears twice anywhere.
- The draft MUST create a clear NEED for the missing ${ROLE} slot — one of:
    • a missing damage type (e.g. comp is full AD → needs magic damage)
    • an unanswered enemy threat (e.g. fed-carry potential with no peel/CC)
    • an incomplete synergy begging completion (e.g. Yasuo with no knock-up)
    • a hard counter opportunity vs the enemy laner in that role
- ${difficultyGuide}

⛔ ROLE VALIDITY — THE #1 RULE, ZERO TOLERANCE:
EVERY champion — in the draft picks AND in the answer key — MUST be a champion that is genuinely played in its assigned role in ranked this patch. NEVER place a champion in a role it does not play.
- TOP: bruisers/tanks/juggernauts (Aatrox, Darius, Ornn, Renekton, Sett, Camille, Gnar, Jax, K'Sante, Malphite). Some ranged (Teemo, Quinn). NEVER bot-lane ADCs, NEVER enchanters.
- JUNGLE: junglers only (Lee Sin, Viego, Vi, Kha'Zix, Hecarim, Sejuani, Nidalee, Kindred, Maokai). NEVER pure lane champs.
- MID: mages & assassins (Ahri, Syndra, Orianna, Zed, Viktor, Sylas, Yone, Akali, Hwei, Vex). NEVER supports (NO Sona, Soraka, Janna, Lulu, Leona, Nautilus, Thresh, Karma), NEVER bot-lane ADCs.
- ADC (bot carry): marksmen (Jinx, Caitlyn, Ezreal, Kai'Sa, Aphelios, Jhin, Ashe, Lucian, Xayah). NEVER tanks/bruisers/supports.
- SUPPORT: engage tanks & enchanters (Leona, Nautilus, Thresh, Lulu, Janna, Soraka, Karma, Rakan, Braum, Pyke). NEVER mid mages played mid, NEVER ADCs, NEVER junglers.
If you are not 100% sure a champion is played in the missing role this patch, DO NOT use it. A wrong-role pick (e.g. Sona in MID) is a critical failure that ruins the puzzle.

ANSWER KEY (8-11 champions, graded):
- 1-2 "perfect": the ideal pick(s) — best possible answer
- 2-3 "great": strong, almost as good
- 2-3 "good": playable, solves part of the need
- 1-2 "questionable": works but suboptimal
- 2-3 "trap": LOOK tempting but are WRONG here (wrong damage type vs their tank, gets hard-countered, redundant role) — these teach the lesson
- Each "reason": 8-20 words, cite the SPECIFIC draft reason (name champions/threats).

PROGRESSIVE HINTS (exactly 3, ordered subtle → obvious — shown one at a time when the player guesses wrong):
- hints[0] SUBTLE: name the enemy comp's identity / win condition. NO champion names, NO answer. e.g. "Their team is a hard-engage dive comp built around catching one target."
- hints[1] MEDIUM: point at what YOUR team is missing — the function/role needed. e.g. "You have no way to disengage or peel for your carries once they jump."
- hints[2] OBVIOUS: describe the KIND of champion that solves it, still without naming the exact answer. e.g. "An enchanter with a hard disengage tool (knockback / airborne) would neutralize their engage."

Respond ONLY with valid JSON — no markdown, no text outside JSON:
{
  "scenario": "1-2 sentences: the situation + what to weigh (no spoilers of the answer)",
  "hints": ["subtle hint", "medium hint", "obvious hint"],
  "difficulty": "${difficulty}",
  "missingTeam": "ally",
  "missingRole": "${role}",
  "side": "blue or red — vary it",
  "allyPicks": [ ... exactly 4 entries for the OTHER four roles, NEVER include role "${role}" ],
  "enemyPicks": [ ... exactly 5 entries, one per role, INCLUDING "${role}" ],
  "allyBans": [{"championId":"Zed","championName":"Zed"}, ... 5],
  "enemyBans": [{"championId":"...","championName":"..."}, ... 5],
  "answers": [
    {"championId":"Orianna","championName":"Orianna","grade":"perfect","reason":"AP shockwave counters their full-AD dive and adds the magic damage your comp lacks"},
    {"championId":"Yasuo","championName":"Yasuo","grade":"trap","reason":"Tempting carry but adds no magic damage vs their armor-stacked Ornn/Malphite"}
  ]
}

STRICT: All championId in valid DDragon format — NO spaces or apostrophes (MissFortune, KSante, BelVeth, ChoGath, KaiSa, Wukong=MonkeyKing). The missing role must be empty on the missing team. answers must NOT contain banned champions.`;
  }

  private parsePuzzleResponse(res: AiChatResponse, difficulty: PuzzleDifficulty, role: DraftRole): DraftPuzzle | null {
    try {
      const cleaned = this.content(res);
      const p = JSON.parse(cleaned);

      const sanId = (s: string) => String(s ?? '').trim().replace(/['\s`.]/g, '');
      const champ = (c: any) => ({ id: sanId(c?.championId ?? c?.id), name: String(c?.championName ?? c?.name ?? '').trim() });
      const pick = (c: any) => ({ role: c?.role as DraftRole, champion: champ(c) });
      const VALID_GRADES = new Set<PickGrade>(['perfect', 'great', 'good', 'questionable', 'trap']);

      const answers: PuzzleAnswer[] = (Array.isArray(p.answers) ? p.answers : [])
        .filter((a: any) => a?.championId && a?.grade && VALID_GRADES.has(a.grade))
        .map((a: any) => ({
          championId: sanId(a.championId),
          championName: String(a.championName ?? a.championId).trim(),
          grade: a.grade as PickGrade,
          reason: String(a.reason ?? '').trim(),
        }));

      if (answers.length === 0) return null;
      if (!answers.some((a) => a.grade === 'perfect' || a.grade === 'great')) return null;

      const hints: string[] = (Array.isArray(p.hints) ? p.hints : [])
        .map((h: unknown) => String(h ?? '').trim())
        .filter((h: string) => h.length > 0)
        .slice(0, 3);

      // Force the requested role/team and guarantee the ally slot for it is empty
      const allyPicks = (Array.isArray(p.allyPicks) ? p.allyPicks : [])
        .map(pick)
        .filter((pk: { role: DraftRole }) => pk.role !== role);

      return {
        id: Date.now().toString(),
        difficulty,
        scenario: String(p.scenario ?? '').trim(),
        missingTeam: 'ally',
        missingRole: role,
        side: p.side === 'red' ? 'red' : 'blue',
        allyPicks,
        enemyPicks: (Array.isArray(p.enemyPicks) ? p.enemyPicks : []).map(pick),
        allyBans: (Array.isArray(p.allyBans) ? p.allyBans : []).map(champ),
        enemyBans: (Array.isArray(p.enemyBans) ? p.enemyBans : []).map(champ),
        answers,
        hints,
      };
    } catch {
      return null;
    }
  }

  /** Real OP.GG counter data block for the grading prompt (empty if none) */
  private buildGradeRealData(puzzle: DraftPuzzle): string {
    if (!puzzle.enemyLaner || !puzzle.realCounters?.length) return '';
    const top = puzzle.realCounters
      .slice(0, 8)
      .map((c) => `${c.name} (${c.winRate}% WR)`)
      .join(', ');
    return `
=== REAL OP.GG DATA (authoritative — weigh heavily) ===
Enemy ${puzzle.enemyLaner} is ${puzzle.enemyDamageType ?? 'MIXED'} damage.
Champions with PROVEN win rates vs ${puzzle.enemyLaner} this patch: ${top}
If the player's pick is in this list with >52% WR, it is a statistically strong lane pick — do NOT grade it "trap".`;
  }

  private buildGradePrompt(puzzle: DraftPuzzle, championName: string): string {
    const langInstruction = this.ls.T().aiLang;
    const fmt = (picks: { role: DraftRole; champion: { name: string } | null }[]) =>
      picks.filter(p => p.champion).map(p => `${p.role}: ${p.champion!.name}`).join(', ');

    const missingPicks = puzzle.missingTeam === 'ally' ? puzzle.allyPicks : puzzle.enemyPicks;
    const otherPicks   = puzzle.missingTeam === 'ally' ? puzzle.enemyPicks : puzzle.allyPicks;

    return `You are grading a League of Legends draft puzzle answer. Patch ${this.patchService.version()}.
${langInstruction}

The player must pick ${puzzle.missingRole.toUpperCase()} for their team.
Their team: ${fmt(missingPicks)}
Opposing team: ${fmt(otherPicks)}
Scenario: ${puzzle.scenario}
${this.buildGradeRealData(puzzle)}
The player chose: ${championName.toUpperCase()}

Grade this specific pick for this exact draft. Grades:
  perfect — the ideal answer
  great — strong, nearly ideal
  good — solid, solves part of the need
  questionable — works but clearly suboptimal
  trap — looks tempting but is wrong here (explain why)

Respond ONLY with valid JSON: {"grade":"good","reason":"8-20 words citing the specific draft reason"}`;
  }

  private parseGradeResponse(res: AiChatResponse, championName: string): PuzzleAnswer {
    const VALID = new Set<PickGrade>(['perfect', 'great', 'good', 'questionable', 'trap']);
    try {
      const cleaned = this.content(res);
      const p = JSON.parse(cleaned);
      const grade: PickGrade = VALID.has(p.grade) ? p.grade : 'questionable';
      return {
        championId: championName.replace(/['\s`.]/g, ''),
        championName,
        grade,
        reason: String(p.reason ?? '').trim() || 'No specific synergy or counter in this draft.',
      };
    } catch {
      return { championId: championName.replace(/['\s`.]/g, ''), championName, grade: 'questionable', reason: 'Could not evaluate this pick.' };
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
