import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { map } from 'rxjs/operators';
import { selectAllyPicks, selectEnemyPicks, selectCompSummary, selectIsLoadingCompSummary } from '@store/draft/draft.selectors';
import { ChampionsService } from '@core/services/champions.service';
import { DraftPick, CompSummary } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';

export interface CompProfile {
  engageScore: number;
  pokeScore: number;
  assassinScore: number;
  adScore: number;
  apScore: number;
  frontlineScore: number;
  archetype: string;
  filled: number;
}

function analyzeComp(picks: DraftPick[], champMap: Map<string, Champion>): CompProfile {
  const champs = picks
    .filter((p) => p.champion)
    .map((p) => champMap.get(p.champion!.id))
    .filter(Boolean) as Champion[];
  const tags = champs.flatMap((c) => c.tags);
  const count = (t: string) => tags.filter((x) => x === t).length;

  const tank = count('Tank');
  const fighter = count('Fighter');
  const mage = count('Mage');
  const assassin = count('Assassin');
  const marksman = count('Marksman');
  const support = count('Support');
  const total = champs.length || 1;

  const engageScore     = Math.min(100, ((tank * 2.5 + fighter * 1) / (total * 2)) * 100);
  const pokeScore       = Math.min(100, ((mage * 2 + marksman * 1.5) / (total * 2)) * 100);
  const assassinScore   = Math.min(100, ((assassin * 2.5) / (total * 2)) * 100);
  const frontlineScore  = Math.min(100, ((tank * 2 + fighter) / (total * 2)) * 100);
  const adScore         = Math.min(100, ((fighter + marksman + assassin) / total) * 60);
  const apScore         = Math.min(100, ((mage + support) / total) * 60);

  const archetype =
    engageScore >= 45   ? 'Engage'
    : pokeScore >= 45   ? 'Poke'
    : assassinScore >= 45 ? 'Pick/Burst'
    : total < 2         ? '—'
    : 'Mixed';

  return { engageScore, pokeScore, assassinScore, adScore, apScore, frontlineScore, archetype, filled: champs.length };
}

interface ThreatAnalysis {
  threat: string;
  needs: string[];
}

function buildThreatAnalysis(enemy: CompProfile, ally: CompProfile): ThreatAnalysis | null {
  if (enemy.filled < 2) return null;

  let threat = '';
  const needs: string[] = [];

  // Dominant enemy win condition
  if (enemy.engageScore >= 50) {
    threat = 'Heavy engage — they dive your backline hard';
    if (ally.frontlineScore < 25)
      needs.push('Add disengage or peel — ally has no frontline to absorb the dive');
    else
      needs.push('Frontline present — hold dive timing, fight after their engage is burned');
  } else if (enemy.pokeScore >= 50) {
    threat = 'Poke / siege — whittle down then take objectives';
    if (ally.engageScore < 30)
      needs.push('Need hard engage to close gap and force fights before they poke you out');
    else
      needs.push('Engage available — bait poke window then all-in below 70% HP');
  } else if (enemy.assassinScore >= 50) {
    threat = 'Pick comp — one-shot isolated targets and snowball';
    needs.push('Group up, ward flanks, build Stopwatch/Zhonya\'s vs their burst');
  } else if (enemy.filled >= 3) {
    threat = 'Balanced mixed comp — no single hard win condition';
  }

  // Damage type counter-build hints
  if (enemy.adScore > 75 && enemy.apScore < 20)
    needs.push('Full AD enemy — prioritize armor (Randuin\'s, Thornmail, Frozen Heart)');
  else if (enemy.apScore > 75 && enemy.adScore < 20)
    needs.push('Full AP enemy — build MR (Mercs, Force of Nature, Wit\'s End)');

  // Ally composition gaps
  if (ally.filled >= 3) {
    if (ally.frontlineScore < 20 && enemy.archetype !== 'Poke')
      needs.push('Ally has no frontline — a tank or bruiser is needed before locking carries');
    if (ally.adScore < 15 && ally.apScore < 15)
      needs.push('Ally lacks damage output — add a carry before the draft closes');
  }

  if (!threat) return null;
  return { threat, needs: needs.slice(0, 2) };
}

@Component({
  selector: 'app-comp-analysis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './comp-analysis.html',
  styleUrl: './comp-analysis.scss',
})
export class CompAnalysis {
  private store = inject(Store);
  private championsService = inject(ChampionsService);

  private allyPicks = toSignal(this.store.select(selectAllyPicks), { initialValue: [] as DraftPick[] });
  private enemyPicks = toSignal(this.store.select(selectEnemyPicks), { initialValue: [] as DraftPick[] });

  private champMap = toSignal(
    this.championsService.getChampions().pipe(
      map((champs) => new Map(champs.map((c) => [c.id, c]))),
    ),
    { initialValue: new Map<string, Champion>() },
  );

  allyComp  = computed(() => analyzeComp(this.allyPicks(),  this.champMap()));
  enemyComp = computed(() => analyzeComp(this.enemyPicks(), this.champMap()));

  threatAnalysis = computed(() => buildThreatAnalysis(this.enemyComp(), this.allyComp()));

  compSummary       = toSignal(this.store.select(selectCompSummary),          { initialValue: null as CompSummary | null });
  isLoadingCompSummary = toSignal(this.store.select(selectIsLoadingCompSummary), { initialValue: false });

  archetypeClass(archetype: string): string {
    switch (archetype) {
      case 'Engage':     return 'archetype-engage';
      case 'Poke':       return 'archetype-poke';
      case 'Pick/Burst': return 'archetype-burst';
      default:           return 'archetype-mixed';
    }
  }
}
