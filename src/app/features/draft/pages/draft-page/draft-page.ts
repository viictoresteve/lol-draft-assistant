import {
  Component, ChangeDetectionStrategy, inject, computed, signal,
  OnInit, ElementRef, ViewChild, HostListener,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  selectAllyPicks, selectEnemyPicks, selectAllyBans,
  selectEnemyBans, selectUserRole, selectSide,
} from '@store/draft/draft.selectors';
import * as DraftActions from '@store/draft/draft.actions';
import { PickSlot } from '@features/draft/components/pick-slot/pick-slot';
import { BanPanel } from '@features/draft/components/ban-panel/ban-panel';
import { SuggestionsPanel } from '@features/draft/components/suggestions-panel/suggestions-panel';
import { CompAnalysis } from '@features/draft/components/comp-analysis/comp-analysis';
import { DraftPick, DraftRole, DraftSide } from '@features/draft/models/draft.interface';
import { Champion } from '@shared/models/champion.interface';
import { LanguageService } from '@core/services/language.service';
import { ShareService } from '@core/services/share.service';
import { PatchService } from '@core/services/patch.service';
import { DraftHistoryService, DraftHistoryEntry } from '@core/services/draft-history.service';
import { DRAFT_TEMPLATES, DraftTemplate } from '@features/draft/data/draft-templates';
import html2canvas from 'html2canvas';

const ROLES: DraftRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];
const ROLE_KEYS: Record<string, DraftRole> = {
  '1': 'top', '2': 'jungle', '3': 'mid', '4': 'adc', '5': 'support',
};

@Component({
  selector: 'app-draft-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PickSlot, BanPanel, SuggestionsPanel, CompAnalysis],
  templateUrl: './draft-page.html',
  styleUrl: './draft-page.scss',
})
export class DraftPage implements OnInit {
  private store = inject(Store);
  private route = inject(ActivatedRoute);
  private shareService = inject(ShareService);
  private patchService = inject(PatchService);
  private historyService = inject(DraftHistoryService);
  ls = inject(LanguageService);

  @ViewChild('boardRef') boardRef!: ElementRef<HTMLElement>;

  readonly roles = ROLES;
  readonly templates = DRAFT_TEMPLATES;

  shareCopied  = signal(false);
  exporting    = signal(false);
  showTemplateMenu = signal(false);
  showHistoryMenu  = signal(false);
  templateMode = signal<'enemy' | 'ally'>('enemy');
  history      = signal<DraftHistoryEntry[]>(this.historyService.getAll());

  allyPicks  = toSignal(this.store.select(selectAllyPicks),  { initialValue: [] as DraftPick[] });
  enemyPicks = toSignal(this.store.select(selectEnemyPicks), { initialValue: [] as DraftPick[] });
  allyBans   = toSignal(this.store.select(selectAllyBans),   { initialValue: [] as Champion[] });
  enemyBans  = toSignal(this.store.select(selectEnemyBans),  { initialValue: [] as Champion[] });
  userRole   = toSignal(this.store.select(selectUserRole),   { initialValue: null as DraftRole | null });
  side       = toSignal(this.store.select(selectSide),       { initialValue: 'blue' as DraftSide });

  takenIds = computed(() => [
    ...this.allyPicks().filter((p) => p.champion).map((p) => p.champion!.id),
    ...this.enemyPicks().filter((p) => p.champion).map((p) => p.champion!.id),
    ...this.allyBans().map((c) => c.id),
    ...this.enemyBans().map((c) => c.id),
  ]);

  ngOnInit() {
    const d = this.route.snapshot.queryParamMap.get('d');
    if (d) {
      const parsed = this.shareService.parseUrl(d);
      if (parsed) this.store.dispatch(DraftActions.restoreDraft(parsed));
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (ROLE_KEYS[e.key]) {
      e.preventDefault();
      this.setRole(ROLE_KEYS[e.key]);
    } else if (e.key === 'r') {
      e.preventDefault();
      this.reset();
    } else if (e.key === 'b') {
      e.preventDefault();
      this.setSide(this.side() === 'blue' ? 'red' : 'blue');
    }
  }

  setRole(role: DraftRole) {
    const current = this.userRole();
    this.store.dispatch(DraftActions.setUserRole({ role: current === role ? null : role }));
  }

  setSide(side: DraftSide) {
    this.store.dispatch(DraftActions.setSide({ side }));
  }

  reset() {
    this.saveToHistory();
    this.store.dispatch(DraftActions.resetDraft());
  }

  // ── History ───────────────────────────────────────────────────────────────
  private saveToHistory() {
    this.historyService.save({
      allyPicks:  this.allyPicks(),
      enemyPicks: this.enemyPicks(),
      allyBans:   this.allyBans(),
      enemyBans:  this.enemyBans(),
      userRole:   this.userRole(),
      side:       this.side(),
    });
    this.history.set(this.historyService.getAll());
  }

  restoreFromHistory(entry: DraftHistoryEntry) {
    this.store.dispatch(DraftActions.restoreDraft({
      allyPicks:  entry.allyPicks,
      enemyPicks: entry.enemyPicks,
      allyBans:   entry.allyBans,
      enemyBans:  entry.enemyBans,
      userRole:   entry.userRole,
      side:       entry.side,
    }));
    this.showHistoryMenu.set(false);
  }

  timeAgo(ts: number): string {
    return this.historyService.timeAgo(ts);
  }

  winRate = computed(() => this.historyService.getWinRate());

  markResult(id: string, result: 'win' | 'loss') {
    this.historyService.updateResult(id, result);
    this.history.set(this.historyService.getAll());
  }

  historyPickIcons(entry: DraftHistoryEntry): string[] {
    return entry.allyPicks
      .filter(p => p.champion)
      .map(p => p.champion!.image)
      .slice(0, 5);
  }

  // ── Export PNG ────────────────────────────────────────────────────────────
  async exportPng() {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const el = this.boardRef?.nativeElement;
      if (!el) return;
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#070c10',
        scale: 2,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `lol-draft-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      this.exporting.set(false);
    }
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  copyDraftLink() {
    this.shareService.copyLink().subscribe(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    });
  }

  // ── Templates ─────────────────────────────────────────────────────────────
  applyTemplate(template: DraftTemplate) {
    const mode = this.templateMode();
    const playerRole = this.userRole();
    const version = this.patchService.version();

    const makeChamp = (pick: { id: string; name: string }): Champion => ({
      id: pick.id, name: pick.name, title: '',
      image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${pick.id}.png`,
      tags: [],
    });

    if (mode === 'enemy') {
      for (const role of ROLES) this.store.dispatch(DraftActions.removeEnemyPick({ role }));
      for (const role of ROLES) this.store.dispatch(DraftActions.addEnemyPick({ champion: makeChamp(template.picks[role]), role }));
    } else {
      for (const role of ROLES) this.store.dispatch(DraftActions.removeAllyPick({ role }));
      for (const role of ROLES) {
        if (role !== playerRole)
          this.store.dispatch(DraftActions.addAllyPick({ champion: makeChamp(template.picks[role]), role }));
      }
    }
    this.showTemplateMenu.set(false);
  }

  champUrl(id: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.patchService.version()}/img/champion/${id}.png`;
  }
}
