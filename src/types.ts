export interface Metadata {
  totalPages?: number;
  totalItems?: number;
}

export interface Paged<T> {
  data: T[];
  metadata?: Metadata;
}

export interface Realm {
  stars?: number | string | null;
  leaderboardStatus?: string;
}

export interface MapInfo {
  hash: string;
  songName?: string;
  songAuthorName?: string;
  levelAuthorName?: string;
  coverUrl?: string;
}

export interface DifficultyInfo {
  rawDifficulty?: string;
  gameMode?: string;
}

export interface Leaderboard extends DifficultyInfo {
  id?: string | number;
  realm?: Realm;
  map?: MapInfo;
  difficulty?: DifficultyInfo;
}

export interface Player {
  id: string;
  name?: string;
  playerNameInGame?: string;
  country?: string;
  avatar?: string;
  stats?: { rank?: number };
}

export interface Score {
  accuracy?: number;
  personalBest?: boolean;
  player?: Player;
}

/** One item from GET /players/{id}/scores */
export interface ScoreEntry {
  score?: Score;
  leaderboard?: Leaderboard;
}

/** One item from GET /maps */
export interface RankedMap extends MapInfo {
  leaderboards?: Leaderboard[];
}
