import { Injectable, inject, signal, computed } from '@angular/core';
import { ChampionsService } from '@core/services/champions.service';
import { Champion } from '@shared/models/champion.interface';

/** Community Dragon champion-audio base (keyed by numeric champion key). */
const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1';
const sfxUrl = (key: string) => `${CDRAGON}/champion-sfx-audios/${key}.ogg`;
const voUrl = (key: string) => `${CDRAGON}/champion-choose-vo/${key}.ogg`;

export const TOTAL_SOUND_ROUNDS = 10;
export type SoundPhase = 'idle' | 'playing' | 'summary';

export interface SoundRound {
  champion: { id: string; name: string; image: string; key: string };
}
export interface SoundOutcome {
  champion: { id: string; name: string; image: string };
  guessedChampionId: string | null;
  correct: boolean;
  hintUsed: boolean;
  points: number;
}
interface SoundStats { bestScore: number; gamesPlayed: number; perfectRounds: number; }

const STATS_KEY = 'lol-sound-quiz-stats';

@Injectable({ providedIn: 'root' })
export class SoundQuizService {
  private champService = inject(ChampionsService);

  readonly totalRounds = TOTAL_SOUND_ROUNDS;

  phase    = signal<SoundPhase>('idle');
  round    = signal(0);
  score    = signal(0);
  outcomes = signal<SoundOutcome[]>([]);
  loading  = signal(false);
  error    = signal<string | null>(null);
  current  = signal<SoundRound | null>(null);
  outcome  = signal<SoundOutcome | null>(null);
  hintUsed = signal(false);
  isPlaying = signal(false);
  stats    = signal<SoundStats>(this.loadStats());

  private allChampions: Champion[] = [];
  private used = new Set<string>();
  private sfxAudio: HTMLAudioElement | null = null;
  private voAudio: HTMLAudioElement | null = null;

  roundLabel  = computed(() => `${this.round() + 1} / ${this.totalRounds}`);
  isLastRound = computed(() => this.round() >= this.totalRounds - 1);
  maxScore    = computed(() => this.totalRounds * 100);

  startGame() {
    this.phase.set('playing');
    this.round.set(0);
    this.score.set(0);
    this.outcomes.set([]);
    this.used.clear();
    this.loadChampionsThen(() => this.loadRound());
  }

  retryRound() { this.loadChampionsThen(() => this.loadRound()); }

  private loadChampionsThen(cb: () => void) {
    if (this.allChampions.length > 0) { cb(); return; }
    this.loading.set(true);
    this.champService.getChampions().subscribe({
      next: (champs) => { this.allChampions = champs.filter((c) => !!c.key); this.loading.set(false); cb(); },
      error: () => { this.loading.set(false); this.error.set('Failed to load champions.'); },
    });
  }

  private loadRound(triesLeft = 6) {
    this.error.set(null);
    this.outcome.set(null);
    this.current.set(null);
    this.hintUsed.set(false);
    this.stopAudio();
    this.loading.set(true);

    const champ = this.pickRandomChampion();
    if (!champ?.key) { this.loading.set(false); this.error.set('No champions available.'); return; }

    // Preflight the audio so a round never lands on a broken/missing clip.
    const audio = new Audio(sfxUrl(champ.key));
    audio.preload = 'auto';

    const onReady = () => {
      cleanup();
      this.sfxAudio = audio;
      this.loading.set(false);
      this.current.set({ champion: { id: champ.id, name: champ.name, image: champ.image, key: champ.key! } });
      this.play(); // auto-play (start/next is a user gesture, so browsers allow it)
    };
    const onFail = () => {
      cleanup();
      if (triesLeft > 0) { this.loadRound(triesLeft - 1); }
      else { this.loading.set(false); this.error.set('Could not load a sound. Retry.'); }
    };
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('error', onFail);
    };
    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('error', onFail, { once: true });
    audio.load();
  }

  /** (Re)play the ability sound from the start. */
  play() {
    const a = this.sfxAudio;
    if (!a) return;
    a.currentTime = 0;
    a.onended = () => this.isPlaying.set(false);
    a.play().then(() => this.isPlaying.set(true)).catch(() => this.isPlaying.set(false));
  }

  /** Reveal hint: play the champion's pick voice-line (costs points). */
  useHint() {
    const r = this.current();
    if (!r || this.outcome()) return;
    this.hintUsed.set(true);
    this.voAudio?.pause();
    this.voAudio = new Audio(voUrl(r.champion.key));
    this.voAudio.play().catch(() => { /* VO optional — ignore */ });
  }

  private pickRandomChampion(): Champion | null {
    const pool = this.allChampions.filter((c) => !this.used.has(c.id));
    const src = pool.length > 0 ? pool : this.allChampions;
    if (src.length === 0) return null;
    const champ = src[Math.floor(Math.random() * src.length)];
    this.used.add(champ.id);
    return champ;
  }

  submit(guessedChampionId: string | null) {
    const r = this.current();
    if (!r || this.outcome()) return;
    this.stopAudio();

    const correct = guessedChampionId?.toLowerCase() === r.champion.id.toLowerCase();
    const points = correct ? (this.hintUsed() ? 50 : 100) : 0;
    this.score.update((s) => s + points);

    const outcome: SoundOutcome = {
      champion: { id: r.champion.id, name: r.champion.name, image: r.champion.image },
      guessedChampionId, correct, hintUsed: this.hintUsed(), points,
    };
    this.outcome.set(outcome);
    this.outcomes.update((o) => [...o, outcome]);
  }

  next() {
    if (this.isLastRound()) { this.finishGame(); }
    else { this.round.update((r) => r + 1); this.loadRound(); }
  }

  private finishGame() {
    this.stopAudio();
    this.phase.set('summary');
    const perfects = this.outcomes().filter((o) => o.correct && !o.hintUsed).length;
    this.stats.update((st) => {
      const next: SoundStats = {
        bestScore: Math.max(st.bestScore, this.score()),
        gamesPlayed: st.gamesPlayed + 1,
        perfectRounds: st.perfectRounds + perfects,
      };
      this.saveStats(next);
      return next;
    });
  }

  quitToMenu() {
    this.stopAudio();
    this.phase.set('idle');
    this.current.set(null);
    this.outcome.set(null);
  }

  searchChampions(term: string): Champion[] {
    const t = term.toLowerCase().trim();
    if (!t) return [];
    return this.allChampions.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 30);
  }

  private stopAudio() {
    this.sfxAudio?.pause();
    this.voAudio?.pause();
    this.isPlaying.set(false);
  }

  private loadStats(): SoundStats {
    try { const raw = localStorage.getItem(STATS_KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return { bestScore: 0, gamesPlayed: 0, perfectRounds: 0 };
  }
  private saveStats(s: SoundStats) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
}
