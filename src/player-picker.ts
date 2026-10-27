import { fetchPlayersByName } from "./api";
import { errorMessage } from "./dom";
import type { Player } from "./types";

export function extractPlayerId(value: string): string {
  const text = value.trim();
  if (/^\d{5,25}$/.test(text)) return text;
  const match =
    text.match(/(?:^|\/)u\/(\d{5,25})(?:\/|$|[?#])/i) ??
    text.match(/(?:^|\D)(\d{5,25})(?:\D|$)/);
  return match?.[1] ?? "";
}

export type PlayerResolution =
  | { kind: "empty" }
  | { kind: "too-short" }
  | { kind: "choose"; count: number }
  | { kind: "resolved"; playerId: string; player: Player | null };

export interface PlayerPickerElements {
  input: HTMLInputElement;
  matchContainer: HTMLElement;
  select: HTMLSelectElement;
  searchStatus: HTMLElement | null;
}

export function createPlayerPicker(el: PlayerPickerElements): {
  resolve(): Promise<PlayerResolution>;
  reset(): void;
} {
  let matchedPlayers: Player[] = [];
  let matchedQuery = "";
  let searchTimer = 0;
  let searchVersion = 0;

  const fillMatches = (query: string, players: Player[]): void => {
    matchedQuery = query;
    matchedPlayers = players;
    el.select.replaceChildren();
    for (const player of players) {
      const option = document.createElement("option");
      option.value = player.id;
      const rank = player.stats?.rank ? `#${player.stats.rank}` : "Unranked";
      option.textContent = `${player.name ?? "Unknown"} · ${player.country || "--"} · ${rank} · ${player.id}`;
      el.select.append(option);
    }
    el.matchContainer.hidden = false;
  };

  const preview = async (query: string, version: number): Promise<void> => {
    try {
      const matches = await fetchPlayersByName(query);
      if (version !== searchVersion || query !== el.input.value.trim()) return;
      const choices = matchingChoices(query, matches);
      if (choices.length) {
        fillMatches(query, choices);
        if (el.searchStatus) el.searchStatus.hidden = true;
      } else if (el.searchStatus) {
        el.searchStatus.textContent = "No matching profiles found.";
        el.searchStatus.hidden = false;
      }
    } catch (error) {
      if (version !== searchVersion || !el.searchStatus) return;
      el.searchStatus.textContent = errorMessage(error, "Player search failed.");
      el.searchStatus.hidden = false;
    }
  };

  const schedulePreview = (): void => {
    const version = ++searchVersion;
    window.clearTimeout(searchTimer);
    matchedPlayers = [];
    matchedQuery = "";
    el.select.replaceChildren();
    el.matchContainer.hidden = true;
    if (!el.searchStatus) return;
    el.searchStatus.hidden = true;
    const query = el.input.value.trim();
    if (query.length < 3 || extractPlayerId(query)) return;
    el.searchStatus.textContent = "Searching profiles...";
    el.searchStatus.hidden = false;
    searchTimer = window.setTimeout(() => void preview(query, version), 250);
  };

  if (el.searchStatus) el.input.addEventListener("input", schedulePreview);

  return {
    async resolve(): Promise<PlayerResolution> {
      const query = el.input.value.trim();
      if (!query) return { kind: "empty" };
      const playerId = extractPlayerId(query);
      if (playerId) return { kind: "resolved", playerId, player: null };
      if (query.length < 3) return { kind: "too-short" };
      if (matchedQuery === query) {
        const player = matchedPlayers.find(
          (item) => item.id === el.select.value,
        );
        if (player) return { kind: "resolved", playerId: player.id, player };
      }

      const matches = await fetchPlayersByName(query);
      const exactMatches = getExactMatches(query, matches);
      if (exactMatches.length === 1) {
        const player = exactMatches[0] ?? null;
        return { kind: "resolved", playerId: player?.id ?? "", player };
      }
      if (matches.length === 1) {
        const player = matches[0] ?? null;
        return { kind: "resolved", playerId: player?.id ?? "", player };
      }
      if (!matches.length) {
        throw new Error(`No ScoreSaber players found for “${query}”.`);
      }
      const choices = exactMatches.length ? exactMatches : matches;
      fillMatches(query, choices);
      return { kind: "choose", count: choices.length };
    },
    reset(): void {
      searchVersion += 1;
      window.clearTimeout(searchTimer);
      matchedPlayers = [];
      matchedQuery = "";
      el.select.replaceChildren();
      el.matchContainer.hidden = true;
      if (el.searchStatus) el.searchStatus.hidden = true;
    },
  };
}

function matchingChoices(query: string, matches: Player[]): Player[] {
  const exactMatches = getExactMatches(query, matches);
  return exactMatches.length ? exactMatches : matches;
}

function getExactMatches(query: string, matches: Player[]): Player[] {
  return matches.filter((player) =>
    [player.name, player.playerNameInGame].some(
      (name) => name?.trim().toLocaleLowerCase() === query.toLocaleLowerCase(),
    ),
  );
}
