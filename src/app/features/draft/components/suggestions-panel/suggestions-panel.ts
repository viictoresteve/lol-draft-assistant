import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { selectSuggestions, selectIsAnalyzing } from '@store/draft/draft.selectors';
import { ChampionCard } from '@shared/components/champion-card/champion-card';

@Component({
  selector: 'app-suggestions-panel',
  imports: [AsyncPipe, ChampionCard, TranslateModule],
  templateUrl: './suggestions-panel.html',
  styleUrl: './suggestions-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionsPanel {
  private store = inject(Store);

  suggestions$ = this.store.select(selectSuggestions);
  isAnalyzing$ = this.store.select(selectIsAnalyzing);
}
