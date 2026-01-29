
export enum GameMode {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  PAUSED = 'PAUSED'
}

export enum PlayMode {
  AI = 'AI',
  LOCAL = 'LOCAL',
  ONLINE = 'ONLINE'
}

export enum PlayerType {
  HUMAN = 'HUMAN',
  AI = 'AI'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum CoinType {
  WHITE = 'WHITE',
  BLACK = 'BLACK',
  QUEEN = 'QUEEN',
  STRIKER = 'STRIKER'
}

export enum CoinState {
  ACTIVE = 'ACTIVE',
  POCKETED = 'POCKETED',
  REMOVED = 'REMOVED'
}

export enum GamePhase {
  PLACING = 'PLACING', // Moving striker left/right
  AIMING = 'AIMING',   // Pulling back
  SHOOTING = 'SHOOTING', // Physics active
  SETTLING = 'SETTLING'  // Waiting for pieces to stop
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: CoinType;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  mass: number;
  state: CoinState;
  color: string;
}

export interface GameSettings {
  playMode: PlayMode;
  difficulty: Difficulty;
  soundEnabled: boolean;
  roomId?: string;
  isHost?: boolean;
}

export interface GameScore {
  white: number;
  black: number;
  queenPocketedBy: CoinType | null; // WHITE or BLACK
  queenCovered: boolean;
  winner: string | null;
}
