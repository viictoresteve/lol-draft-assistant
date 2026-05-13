export interface Champion {
  id: string;
  name: string;
  title: string;
  image: string;
  tags: ChampionTag[];
}

export type ChampionTag = 'Fighter' | 'Tank' | 'Mage' | 'Assassin' | 'Support' | 'Marksman';
