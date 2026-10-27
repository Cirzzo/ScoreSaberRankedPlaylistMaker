import { $, errorMessage, pause, setButtonLabel } from "./dom";
import {
  fetchPlayersByName,
  fetchRankedMapPage,
  fetchScorePage,
  PAGE_PAUSE_MS,
} from "./api";
import { buildSongs, downloadPlaylist, type Playlist } from "./playlist";
import { RangeSlider, STAR_SLIDER } from "./slider";
import { StatusLine, createTrackRow } from "./ui";
import type { Leaderboard, Player, RankedMap } from "./types";

interface RankedEntry {
  map: RankedMap;
  leaderboard: Leaderboard;
  stars: number;
}

export function initRankedTool(): void {
  const form = $<HTMLFormElement>("#ranked-form");
  const fetchButton = $<HTMLButtonElement>("#ranked-fetch-button");
  const resultsTitle = $("#ranked-results-title");
  const resultsSubtitle = $("#ranked-results-subtitle");
  const count = $("#ranked-count");
  const downloadButton = $<HTMLButtonElement>("#ranked-download-button");
  const splitToggle = $<HTMLInputElement>("#ranked-split-difficulties");
  const unplayedToggle = $<HTMLInputElement>("#ranked-unplayed-toggle");
  const playerFields = $("#ranked-player-fields");
  const playerInput = $<HTMLInputElement>("#ranked-player-input");
  const playerMatch = $("#ranked-player-match");
  const playerMatchSelect = $<HTMLSelectElement>("#ranked-player-match-select");
  const playerSearchStatus = $("#ranked-player-search-status");
  const trackList = $("#ranked-track-list");
  const emptyState = $("#ranked-empty-state");
  const status = new StatusLine(
    $("#ranked-status-line"),
    $("#ranked-status-text"),
  );

  const stars = new RangeSlider({
    ...STAR_SLIDER,
    root: $("#ranked-star-range-control"),
    fill: $("#ranked-star-range-fill"),
    minHandle: $("#ranked-star-min-handle"),
    maxHandle: $("#ranked-star-max-handle"),
    output: $("#ranked-star-range-output"),
    low: 0,
    high: 10,
  });

  let entries: RankedEntry[] = [];
  let activeRequest = 0;
  let matchedPlayers: Player[] = [];
  let matchedPlayerQuery = "";
  let playerSearchTimer = 0;
  let playerSearchVersion = 0;

  unplayedToggle.addEventListener("change", () => {
    playerFields.hidden = !unplayedToggle.checked;
    playerInput.required = unplayedToggle.checked;
    if (!unplayedToggle.checked) {
      playerSearchVersion += 1;
      window.clearTimeout(playerSearchTimer);
      playerMatch.hidden = true;
      playerSearchStatus.hidden = true;
    }
  });
  playerInput.addEventListener("input", () => {
    const version = ++playerSearchVersion;
    window.clearTimeout(playerSearchTimer);
    matchedPlayers = [];
    matchedPlayerQuery = "";
    playerMatchSelect.replaceChildren();
    playerMatch.hidden = true;
    playerSearchStatus.hidden = true;
    const query = playerInput.value.trim();
    if (query.length < 3 || extractPlayerId(query)) return;
    playerSearchStatus.textContent = "Searching profiles...";
    playerSearchStatus.hidden = false;
    playerSearchTimer = window.setTimeout(() => {
      void previewPlayerSearch(query, version);
    }, 250);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void fetchAll();
  });
  downloadButton.addEventListener("click", download);

  async function previewPlayerSearch(query: string, version: number): Promise<void> {
    try {
      const matches = await fetchPlayersByName(query);
      if (version !== playerSearchVersion || query !== playerInput.value.trim()) return;
      const exactMatches = matches.filter((candidate) =>
        [candidate.name, candidate.playerNameInGame].some(
          (name) => name?.trim().toLocaleLowerCase() === query.toLocaleLowerCase(),
        ),
      );
      const choices = exactMatches.length ? exactMatches : matches;
      if (choices.length) {
        showPlayerMatches(query, choices);
        playerSearchStatus.hidden = true;
      } else {
        playerSearchStatus.textContent = "No matching profiles found.";
        playerSearchStatus.hidden = false;
      }
    } catch (error) {
      if (version !== playerSearchVersion) return;
      playerSearchStatus.textContent = errorMessage(error, "Player search failed.");
      playerSearchStatus.hidden = false;
    }
  }

  async function fetchAll(): Promise<void> {
    const playerQuery = unplayedToggle.checked ? playerInput.value.trim() : "";
    if (unplayedToggle.checked && !playerQuery) {
      status.error("Enter a player name, ScoreSaber ID, or profile URL.");
      playerInput.focus();
      return;
    }
    let playerId = playerQuery ? extractPlayerId(playerQuery) : "";
    let player: Player | null = null;
    if (playerQuery && !playerId && matchedPlayerQuery === playerQuery) {
      player =
        matchedPlayers.find((p) => p.id === playerMatchSelect.value) ?? null;
      playerId = player?.id ?? "";
    }
    if (playerQuery && !playerId && playerQuery.length < 3) {
      status.error("Player names must be at least 3 characters long.");
      playerInput.focus();
      return;
    }

    const requestId = ++activeRequest;
    const minimumStars = stars.low;
    const maximumStars = stars.high;
    entries = [];
    trackList.replaceChildren();
    fetchButton.disabled = true;
    setButtonLabel(fetchButton, "Fetching maps...");
    downloadButton.disabled = true;
    count.textContent = "... DIFFICULTIES";
    resultsTitle.textContent = "Fetching ranked maps...";
    resultsSubtitle.textContent = `Loading ${minimumStars.toFixed(1)}-${maximumStars.toFixed(1)} stars...`;
    status.show("Connecting to ScoreSaber ranked maps...");

    try {
      if (playerQuery && !playerId) {
        status.show("Searching ScoreSaber players...");
        const matches = await fetchPlayersByName(playerQuery);
        if (requestId !== activeRequest) return;
        const wanted = playerQuery.toLocaleLowerCase();
        const exactMatches = matches.filter((candidate) =>
          [candidate.name, candidate.playerNameInGame].some(
            (name) => name?.trim().toLocaleLowerCase() === wanted,
          ),
        );
        if (exactMatches.length === 1) player = exactMatches[0] ?? null;
        else if (matches.length === 1) player = matches[0] ?? null;
        else if (!matches.length)
          throw new Error(`No ScoreSaber players found for “${playerQuery}”.`);
        else {
          const choices = exactMatches.length ? exactMatches : matches;
          showPlayerMatches(playerQuery, choices);
          status.show(
            "More than one player matched. Choose a profile, then fetch ranked maps again.",
          );
          resultsTitle.textContent = "Choose a player";
          resultsSubtitle.textContent = `${choices.length} matching profiles found.`;
          fetchButton.disabled = false;
          setButtonLabel(fetchButton, "Fetch ranked maps");
          count.textContent = "0 DIFFICULTIES";
          return;
        }
        playerId = player?.id ?? "";
      }
      playerMatch.hidden = true;
      matchedPlayerQuery = "";
      matchedPlayers = [];

      const firstPage = await fetchRankedMapPage(1, minimumStars, maximumStars);
      if (requestId !== activeRequest) return;
      const totalPages = Math.max(
        1,
        Number(firstPage.metadata?.totalPages) || 1,
      );
      const totalMaps = Number(firstPage.metadata?.totalItems) || 0;
      const allMaps: RankedMap[] = [];

      for (let page = 1; page <= totalPages; page += 1) {
        if (requestId !== activeRequest) return;
        if (page > 1) {
          status.show(
            `Loading maps ${allMaps.length.toLocaleString()} of ${totalMaps.toLocaleString()}... page ${page} of ${totalPages}`,
          );
          await pause(PAGE_PAUSE_MS);
        } else {
          status.show(
            `Connected. Loading ${totalMaps.toLocaleString()} matching maps...`,
          );
        }
        const payload =
          page === 1
            ? firstPage
            : await fetchRankedMapPage(page, minimumStars, maximumStars);
        allMaps.push(...payload.data);
        status.show(
          `Loaded ${allMaps.length.toLocaleString()} of ${totalMaps.toLocaleString()} maps... page ${page} of ${totalPages}`,
        );
      }

      if (totalMaps > 0 && allMaps.length !== totalMaps) {
        throw new Error(
          `Incomplete map fetch: received ${allMaps.length} of ${totalMaps} maps. Retry to load the full result.`,
        );
      }

      const playedHashes = new Set<string>();
      if (playerId) {
        const firstScores = await fetchScorePage(playerId, 1);
        if (requestId !== activeRequest) return;
        const scorePages = Math.max(
          1,
          Number(firstScores.metadata?.totalPages) || 1,
        );
        for (let page = 1; page <= scorePages; page += 1) {
          if (requestId !== activeRequest) return;
          if (page > 1) {
            status.show(
              `Checking your scores... page ${page} of ${scorePages}`,
            );
            await pause(PAGE_PAUSE_MS);
          }
          const payload =
            page === 1 ? firstScores : await fetchScorePage(playerId, page);
          for (const score of payload.data) {
            const hash = score.leaderboard?.map?.hash;
            if (hash) playedHashes.add(hash.toUpperCase());
          }
        }
      }

      const seen = new Set<string>();
      const collected: RankedEntry[] = [];
      for (const map of allMaps) {
        if (playedHashes.has(map.hash.toUpperCase())) continue;
        for (const leaderboard of map.leaderboards ?? []) {
          const starValue = Number(leaderboard.realm?.stars);
          if (
            leaderboard.realm?.leaderboardStatus !== "RANKED" ||
            !Number.isFinite(starValue) ||
            starValue < minimumStars ||
            starValue > maximumStars
          )
            continue;
          const key = String(
            leaderboard.id ??
              `${map.hash}:${leaderboard.gameMode}:${leaderboard.rawDifficulty}`,
          );
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push({ map, leaderboard, stars: starValue });
        }
      }
      collected.sort(
        (a, b) =>
          a.stars - b.stars ||
          (a.map.songName ?? "").localeCompare(b.map.songName ?? ""),
      );

      if (requestId !== activeRequest) return;
      entries = collected;
      render();
      fetchButton.disabled = false;
      setButtonLabel(fetchButton, "Refresh ranked maps");
      status.hide();
      resultsTitle.textContent = "Ranked maps ready.";
      resultsSubtitle.textContent = `${entries.length.toLocaleString()} difficulties across ${uniqueMapCount().toLocaleString()} matching maps (${allMaps.length.toLocaleString()} maps scanned)${playerId ? `; filtered for ${player?.name || player?.playerNameInGame || `player ${playerId}`}` : ""}.`;
    } catch (error) {
      if (requestId !== activeRequest) return;
      fetchButton.disabled = false;
      setButtonLabel(fetchButton, "Retry ranked maps");
      count.textContent = "0 DIFFICULTIES";
      resultsTitle.textContent = "Could not load ranked maps.";
      resultsSubtitle.textContent = "Retry the request.";
      status.error(
        errorMessage(error, "Could not load ranked maps from ScoreSaber."),
      );
    }
  }

  function extractPlayerId(value: string): string {
    const text = value.trim();
    if (/^\d{5,25}$/.test(text)) return text;
    const match =
      text.match(/(?:^|\/)u\/(\d{5,25})(?:\/|$|[?#])/i) ??
      text.match(/(?:^|\D)(\d{5,25})(?:\D|$)/);
    return match?.[1] ?? "";
  }

  function showPlayerMatches(query: string, players: Player[]): void {
    matchedPlayerQuery = query;
    matchedPlayers = players;
    playerMatchSelect.replaceChildren();
    for (const candidate of players) {
      const option = document.createElement("option");
      option.value = candidate.id;
      const rank = candidate.stats?.rank
        ? `#${candidate.stats.rank}`
        : "Unranked";
      option.textContent = `${candidate.name ?? "Unknown"} · ${candidate.country || "--"} · ${rank} · ${candidate.id}`;
      playerMatchSelect.append(option);
    }
    playerMatch.hidden = false;
  }

  function uniqueMapCount(): number {
    return new Set(entries.map((entry) => entry.map.hash)).size;
  }

  function render(): void {
    if (!entries.length) {
      trackList.replaceChildren(emptyState);
      count.textContent = "0 DIFFICULTIES";
      downloadButton.disabled = true;
      return;
    }
    trackList.replaceChildren(...entries.map(createRow));
    count.textContent = `${entries.length.toLocaleString()} DIFFICULTIES`;
    downloadButton.disabled = false;
  }

  function createRow({
    map,
    leaderboard,
    stars: starValue,
  }: RankedEntry): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "accuracy-cell ranked-stars-cell";
    cell.textContent = `${starValue.toFixed(2)}★`;
    return createTrackRow(map, leaderboard, cell, "track-row ranked-track-row");
  }

  function download(): void {
    if (!entries.length) return;
    const split = splitToggle.checked;
    const low = stars.low.toFixed(1);
    const high = stars.high.toFixed(1);
    const mapCount = uniqueMapCount();
    const playlist: Playlist = {
      playlistTitle: `Ranked Maps ${low}-${high} Stars`,
      playlistAuthor: "Cirzzo's Playlist Maker",
      playlistDescription: split
        ? `${entries.length} ranked difficulties as separate entries across ${mapCount} maps.`
        : `${entries.length} ranked difficulties grouped across ${mapCount} maps.`,
      songs: buildSongs(
        entries.map((e) => ({ map: e.map, difficulty: e.leaderboard })),
        split,
      ),
      coverImage: "",
      allowDuplicates: split,
    };
    downloadPlaylist(playlist, `ranked-maps-${low}-${high}-stars.bplist`);
  }
}
