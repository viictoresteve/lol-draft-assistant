export interface Champion {
  id: string;
  name: string;
  title: string;
  image: string;
  tags: ChampionTag[];
  /** Numeric DDragon key (e.g. "266" for Aatrox) — used for high-res splash art. */
  key?: string;
}

export type ChampionTag = 'Fighter' | 'Tank' | 'Mage' | 'Assassin' | 'Support' | 'Marksman';
