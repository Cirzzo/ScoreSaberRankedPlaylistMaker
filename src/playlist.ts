import type { DifficultyInfo, MapInfo } from "./types";

export interface PlaylistDifficulty {
  name: string;
  characteristic: string;
}

export interface PlaylistSong {
  key: string;
  hash: string;
  songName: string;
  levelAuthorName: string;
  difficulties: PlaylistDifficulty[];
}

export interface Playlist {
  playlistTitle: string;
  playlistAuthor: string;
  playlistDescription: string;
  songs: PlaylistSong[];
  coverImage: string;
  allowDuplicates: boolean;
}

export function formatPlaylistDifficulty(
  difficulty: DifficultyInfo,
): PlaylistDifficulty {
  const rawName = String(difficulty.rawDifficulty || "Expert").replace(/^_/, "");
  const gameMode = String(difficulty.gameMode || "SoloStandard");
  return {
    name: rawName.split("_")[0] || "Expert",
    characteristic: gameMode.replace(/^Solo/, "") || gameMode,
  };
}

export interface PlaylistItem {
  map: MapInfo;
  difficulty: DifficultyInfo;
}

/**
 * Builds the `songs` array. With `split`, every item becomes its own entry;
 * otherwise items are grouped by map hash with de-duplicated difficulties.
 */
export function buildSongs(items: PlaylistItem[], split: boolean): PlaylistSong[] {
  const grouped = new Map<string, PlaylistSong>();
  const separate: PlaylistSong[] = [];

  for (const { map, difficulty } of items) {
    const hash = String(map.hash).toUpperCase();
    const entry = formatPlaylistDifficulty(difficulty);
    if (split) {
      separate.push(newSong(map, hash, [entry]));
      continue;
    }
    let song = grouped.get(hash);
    if (!song) {
      song = newSong(map, hash, []);
      grouped.set(hash, song);
    }
    const exists = song.difficulties.some(
      (d) => d.name === entry.name && d.characteristic === entry.characteristic,
    );
    if (!exists) song.difficulties.push(entry);
  }
  return split ? separate : [...grouped.values()];
}

function newSong(
  map: MapInfo,
  hash: string,
  difficulties: PlaylistDifficulty[],
): PlaylistSong {
  return {
    key: hash,
    hash,
    songName: map.songName || "Unknown track",
    levelAuthorName: map.levelAuthorName || "Unknown mapper",
    difficulties,
  };
}

export function downloadPlaylist(playlist: Playlist, filename: string): void {
  const blob = new Blob([JSON.stringify(playlist, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "scoresaber-player"
  );
}
