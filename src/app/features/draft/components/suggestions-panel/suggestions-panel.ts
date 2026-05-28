import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { selectSuggestions, selectIsAnalyzing, selectUserRole } from '@store/draft/draft.selectors';
import { selectPoolChampionIds } from '@store/pool/pool.selectors';
import { Suggestion, DraftRole } from '@features/draft/models/draft.interface';
import { LanguageService } from '@core/services/language.service';

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

@Component({
  selector: 'app-suggestions-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './suggestions-panel.html',
  styleUrl: './suggestions-panel.scss',
})
export class SuggestionsPanel {
  private store = inject(Store);
  ls = inject(LanguageService);

  private rawSuggestions = toSignal(this.store.select(selectSuggestions), {
    initialValue: [] as Suggestion[],
  });
  private poolIds = toSignal(this.store.select(selectPoolChampionIds), {
    initialValue: [] as string[],
  });
  isAnalyzing = toSignal(this.store.select(selectIsAnalyzing), { initialValue: false });
  userRole = toSignal(this.store.select(selectUserRole), { initialValue: null as DraftRole | null });

  suggestions = computed(() =>
    this.rawSuggestions().map((s) => ({
      ...s,
      isInPool: this.poolIds().includes(s.champion.id),
    })),
  );

  getSpellImageUrl(spellName: string): string {
    const id = SPELL_ID_MAP[spellName.toLowerCase()] ?? `Summoner${spellName}`;
    return `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/spell/${id}.png`;
  }
}
