import type { DifficultyInfo, MapInfo } from "./types";
import { formatPlaylistDifficulty } from "./playlist";

export class StatusLine {
  constructor(
    private readonly line: HTMLElement,
    private readonly text: HTMLElement,
  ) {}

  show(message: string): void {
    this.line.hidden = false;
    this.line.classList.remove("is-error");
    this.text.textContent = message;
  }

  error(message: string): void {
    this.line.hidden = false;
    this.line.classList.add("is-error");
    this.text.textContent = message;
  }

  hide(): void {
    this.line.hidden = true;
    this.line.classList.remove("is-error");
  }
}

export function difficultyClass(value: string | null | undefined): string {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (normalized.includes("expertplus")) return "expertplus";
  if (normalized.includes("expert")) return "expert";
  if (normalized.includes("hard")) return "hard";
  if (normalized.includes("normal")) return "normal";
  return "easy";
}

/** Shared row layout: cover + title/author, difficulty, and a caller-supplied last cell. */
export function createTrackRow(
  map: MapInfo,
  difficulty: DifficultyInfo,
  trailing: HTMLElement,
  className = "track-row",
): HTMLElement {
  const row = document.createElement("article");
  row.className = className;

  const cover = document.createElement("div");
  cover.className = "cover";
  cover.textContent = (map.songName || "?").slice(0, 1).toUpperCase();
  if (map.coverUrl) {
    const image = document.createElement("img");
    image.src = map.coverUrl;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    cover.replaceChildren(image);
  }

  const name = document.createElement("div");
  name.className = "track-name";
  name.textContent = map.songName || "Unknown track";
  const author = document.createElement("div");
  author.className = "track-author";
  author.textContent =
    map.songAuthorName || map.levelAuthorName || "Unknown artist";
  const copy = document.createElement("div");
  copy.className = "track-copy";
  copy.append(name, author);

  const main = document.createElement("div");
  main.className = "track-main";
  main.append(cover, copy);

  const dot = document.createElement("span");
  dot.className = `difficulty-dot ${difficultyClass(difficulty.rawDifficulty)}`;
  const label = formatPlaylistDifficulty(difficulty);
  const text = document.createElement("span");
  text.className = "difficulty-text";
  text.textContent = `${label.characteristic} / ${label.name}`;
  const difficultyCell = document.createElement("div");
  difficultyCell.className = "difficulty-cell";
  difficultyCell.append(dot, text);

  row.append(main, difficultyCell, trailing);
  return row;
}
