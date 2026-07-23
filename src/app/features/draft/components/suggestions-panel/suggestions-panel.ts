import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ImgFallbackDirective } from '@shared/directives/img-fallback.directive';
import { BuildService } from '@core/services/build.service';
import { RunesService } from '@core/services/runes.service';
import { ChampionsService } from '@core/services/champions.service';
import { LanguageService } from '@core/services/language.service';
import { PatchService } from '@core/services/patch.service';
import {
  ChampionTip,
  ChampionTipType,
  DraftPick,
  DraftRole,
  GameplayPhase,
  GameplayTip,
  Suggestion,
} from '@features/draft/models/draft.interface';
import { Store } from '@ngrx/store';
import { Champion } from '@shared/models/champion.interface';
import * as DraftActions from '@store/draft/draft.actions';
import {
  selectAllyBans,
  selectAllyPicks,
  selectChampionTips,
  selectDraftError,
  selectEnemyBans,
  selectEnemyPicks,
  selectGameplayTips,
  selectIsAnalyzing,
  selectIsLoadingChampionTips,
  selectIsLoadingTips,
  selectSuggestions,
  selectUserRole,
} from '@store/draft/draft.selectors';
import * as PoolActions from '@store/pool/pool.actions';
import { selectByRole, selectPoolChampionIds } from '@store/pool/pool.selectors';
import { of, switchMap } from 'rxjs';

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

const PHASE_LABELS: Record<GameplayPhase, { en: string; es: string }> = {
  early: { en: 'Early', es: 'Early' },
  trade: { en: 'Trading', es: 'Tradear' },
  teamfight: { en: 'Teamfight', es: 'Teamfight' },
  win: { en: 'Win cond.', es: 'Ganar' },
  danger: { en: 'Danger', es: 'Peligro' },
};

@Component({
  selector: 'app-suggestions-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImgFallbackDirective],
  templateUrl: './suggestions-panel.html',
  styleUrl: './suggestions-panel.scss',
})
export class SuggestionsPanel {
  private store = inject(Store);
  ls = inject(LanguageService);
  private patchService = inject(PatchService);
  private champService = inject(ChampionsService);
  runes = inject(RunesService);
  private buildService = inject(BuildService);

  private rawSuggestions = toSignal(this.store.select(selectSuggestions), {
    initialValue: [] as Suggestion[],
  });
  private poolIds = toSignal(this.store.select(selectPoolChampionIds), {
    initialValue: [] as string[],
  });
  private allyPicks = toSignal(this.store.select(selectAllyPicks), {
    initialValue: [] as DraftPick[],
  });
  private enemyPicks = toSignal(this.store.select(selectEnemyPicks), {
    initialValue: [] as DraftPick[],
  });
  private allyBans = toSignal(this.store.select(selectAllyBans), {
    initialValue: [] as Champion[],
  });
  private enemyBans = toSignal(this.store.select(selectEnemyBans), {
    initialValue: [] as Champion[],
  });

  isAnalyzing = toSignal(this.store.select(selectIsAnalyzing), { initialValue: false });
  userRole = toSignal(this.store.select(selectUserRole), {
    initialValue: null as DraftRole | null,
  });
  gameplayTips = toSignal(this.store.select(selectGameplayTips), {
    initialValue: [] as GameplayTip[],
  });
  isLoadingTips = toSignal(this.store.select(selectIsLoadingTips), { initialValue: false });
  error = toSignal(this.store.select(selectDraftError), { initialValue: null as string | null });
  championTips = toSignal(this.store.select(selectChampionTips), {
    initialValue: [] as ChampionTip[],
  });
  isLoadingChampionTips = toSignal(this.store.select(selectIsLoadingChampionTips), {
    initialValue: false,
  });

  // Build reactively derived from the picked champion (declared next to its consumer).
  private buildInput = computed(() => {
    const role = this.userRole();
    const champ = role ? this.allyPicks().find((p) => p.role === role)?.champion : null;
    return champ && role ? { champion: champ.name, role } : null;
  });
  build = toSignal(
    toObservable(this.buildInput).pipe(
      switchMap((input) =>
        input ? this.buildService.getBuild(input.champion, input.role) : of(null),
      ),
    ),
    { initialValue: null },
  );

  // Tab toggle: 'suggestions' | 'champion-tips' | 'build'
  panelTab = signal<'suggestions' | 'champion-tips' | 'build'>('suggestions');

  readonly TIP_TYPE_LABELS: Record<ChampionTipType, { label: string; color: string }> = {
    mechanic: { label: 'Mechanic', color: '#6aaaff' },
    synergy: { label: 'Synergy', color: '#0ac8b9' },
    combo: { label: 'Combo', color: '#e0a040' },
    counterplay: { label: 'Counter', color: '#e06060' },
  };

  // Draft complete when all 10 picks are filled
  isDraftComplete = computed(
    () =>
      this.allyPicks().every((p) => p.champion !== null) &&
      this.enemyPicks().every((p) => p.champion !== null),
  );

  // Player champion and opponent for the guide header
  playerChamp = computed(() => {
    const role = this.userRole();
    return role ? (this.allyPicks().find((p) => p.role === role)?.champion?.name ?? null) : null;
  });

  enemyChamp = computed(() => {
    const role = this.userRole();
    return role ? (this.enemyPicks().find((p) => p.role === role)?.champion?.name ?? null) : null;
  });

  // Tips grouped by phase for display order
  readonly phaseOrder: GameplayPhase[] = ['early', 'trade', 'teamfight', 'win', 'danger'];

  tipsForPhase = computed(() => {
    const map = new Map<GameplayPhase, string[]>();
    for (const phase of this.phaseOrder) map.set(phase, []);
    for (const t of this.gameplayTips()) {
      map.get(t.phase)?.push(t.tip);
    }
    return map;
  });

  private takenIds = computed(
    () =>
      new Set([
        ...this.allyPicks()
          .filter((p) => p.champion)
          .map((p) => p.champion!.id),
        ...this.enemyPicks()
          .filter((p) => p.champion)
          .map((p) => p.champion!.id),
        ...this.allyBans().map((c) => c.id),
        ...this.enemyBans().map((c) => c.id),
      ]),
  );

  hasPick = computed(() => {
    const role = this.userRole();
    if (!role) return false;
    return this.allyPicks().some((p) => p.role === role && p.champion !== null);
  });

  suggestions = computed(() =>
    this.rawSuggestions()
      .filter((s) => !this.takenIds().has(s.champion.id))
      .map((s) => ({ ...s, isInPool: this.poolIds().includes(s.champion.id) })),
  );

  // ── Pagination ──
  readonly pageSize = 3;
  page = signal(0);
  pageCount = computed(() => Math.max(1, Math.ceil(this.suggestions().length / this.pageSize)));
  visibleSuggestions = computed(() =>
    this.suggestions().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
  );

  // ── View toggle ──
  activeView = signal<'all' | 'pros' | 'cons'>('all');

  constructor() {
    effect(() => {
      this.rawSuggestions();
      untracked(() => this.page.set(0));
    });
  }

  prevPage() {
    if (this.page() > 0) this.page.update((p) => p - 1);
  }
  nextPage() {
    if (this.page() < this.pageCount() - 1) this.page.update((p) => p + 1);
  }

  setView(v: 'pros' | 'cons') {
    this.activeView.set(this.activeView() === v ? 'all' : v);
  }

  addPick(champion: Champion) {
    const role = this.userRole();
    if (role && !this.hasPick()) {
      this.store.dispatch(DraftActions.addAllyPick({ champion, role }));
    }
  }

  retry() {
    this.store.dispatch(DraftActions.retryAnalysis());
  }

  phaseLabel(phase: GameplayPhase): string {
    const lang = this.ls.lang();
    return PHASE_LABELS[phase]?.[lang] ?? phase;
  }

  getSpellImageUrl(spellName: string): string {
    const id = SPELL_ID_MAP[spellName.toLowerCase()] ?? `Summoner${spellName}`;
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}/img/spell/${id}.png`;
  }

  champIcon(id: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}/img/champion/${id}.png`;
  }

  itemIcon(id: number): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}/img/item/${id}.png`;
  }

  // ── Pool mini-panel ──────────────────────────────────────────────────────

  showPoolPanel = signal(false);
  poolSearchTerm = signal('');

  private byRole = toSignal(this.store.select(selectByRole), {
    initialValue: { top: [], jungle: [], mid: [], adc: [], support: [] } as Record<
      DraftRole,
      Champion[]
    >,
  });

  private allChampions = toSignal(this.champService.getChampions(), {
    initialValue: [] as Champion[],
  });

  currentRolePool = computed(() => {
    const role = this.userRole();
    return role ? (this.byRole()[role] ?? []) : [];
  });

  poolSearchResults = computed(() => {
    const term = this.poolSearchTerm().toLowerCase().trim();
    if (!term) return [];
    const inPool = new Set(this.currentRolePool().map((c) => c.id));
    return this.allChampions()
      .filter((c) => !inPool.has(c.id) && c.name.toLowerCase().includes(term))
      .slice(0, 20);
  });

  togglePoolPanel() {
    this.showPoolPanel.update((v) => !v);
    this.poolSearchTerm.set('');
  }

  addToPool(champion: Champion) {
    const role = this.userRole();
    if (role) this.store.dispatch(PoolActions.addToPool({ champion, role }));
  }

  removeFromPool(championId: string) {
    const role = this.userRole();
    if (role) this.store.dispatch(PoolActions.removeFromPool({ championId, role }));
  }
}
