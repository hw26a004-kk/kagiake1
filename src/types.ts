export type Difficulty = 'novice' | 'apprentice' | 'adept' | 'expert' | 'master';

export interface LockConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  sweetSpotCenter: number; // 0 to 180 degrees representing the correct pick angle
  sweetSpotWidth: number;  // Tolerance angle width (narrower = harder)
  durabilityFactor: number; // Damage multiplier (higher = breaks faster)
  description: string;
  isUnlocked: boolean;
  scoreBonus: number;
}

export type PlayMode = 'levels' | 'timeAttack' | 'custom' | 'training';

export interface GameStats {
  lockpicks: number;
  maxLockpicks: number;
  picksBroken: number;
  locksCleared: number;
  totalTimePlayed: number; // in seconds
  highScore: number;
  experience: number;
  money: number;
}

export interface SoundSettings {
  muted: boolean;
  volume: number; // 0 to 1
}
