export interface Champion {
  id: string;
  name: string;
  title: string;
  image: string;
  tags: ChampionTag[];
  /** Numeric DDragon key (e.g. "266" for Aatrox) — used for high-res splash art. */
  key?: string;
  /** Concrete per-champion factors from Riot DDragon (auto-updates each patch). */
  factors?: ChampionFactors;
}

/** Factual champion traits from DDragon — fed to the AI so it reasons on data, not memory. */
export interface ChampionFactors {
  attack: number;      // 0–10 physical-damage rating
  magic: number;       // 0–10 magic-damage rating
  defense: number;     // 0–10 durability rating
  attackRange: number; // base attack range (melee ≈ 125–175, ranged ≥ 400)
  resource: string;    // partype: Mana / Energy / Blood / None …
}

export type ChampionTag = 'Fighter' | 'Tank' | 'Mage' | 'Assassin' | 'Support' | 'Marksman';
