import { $, errorMessage, pause, setButtonLabel } from "./dom";
import {
  fetchRankedMapPage,
  fetchScorePage,
  PAGE_PAUSE_MS,
} from "./api";
import {
  buildSongs,
  downloadPlaylist,
  slugify,
  type Playlist,
} from "./playlist";
import { RangeSlider, STAR_SLIDER } from "./slider";
import { StatusLine, createTrackRow } from "./ui";
import { createPlayerPicker, extractPlayerId } from "./player-picker";
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
  const playerPicker = createPlayerPicker({
    input: playerInput,
    matchContainer: playerMatch,
    select: playerMatchSelect,
    searchStatus: playerSearchStatus,
  });
  let fetchedMinimumStars = stars.low;
  let fetchedMaximumStars = stars.high;
  let fetchedFilterLabel: string | null = null;

  unplayedToggle.addEventListener("change", () => {
    playerFields.hidden = !unplayedToggle.checked;
    playerInput.required = unplayedToggle.checked;
    if (!unplayedToggle.checked) {
      playerPicker.reset();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void fetchAll();
  });
  downloadButton.addEventListener("click", download);

  async function fetchAll(): Promise<void> {
    const playerQuery = unplayedToggle.checked ? playerInput.value.trim() : "";
    if (unplayedToggle.checked && !playerQuery) {
      status.error("Enter a player name, ScoreSaber ID, or profile URL.");
      playerInput.focus();
      return;
    }
    if (playerQuery && !extractPlayerId(playerQuery) && playerQuery.length < 3) {
      status.error("Player names must be at least 3 characters long.");
      playerInput.focus();
      return;
    }

    let playerId = "";
    let player: Player | null = null;
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
      if (playerQuery) {
        status.show("Searching ScoreSaber players...");
        const resolution = await playerPicker.resolve();
        if (requestId !== activeRequest) return;
        if (resolution.kind === "choose") {
          status.show(
            "More than one player matched. Choose a profile, then fetch ranked maps again.",
          );
          resultsTitle.textContent = "Choose a player";
          resultsSubtitle.textContent = `${resolution.count} matching profiles found.`;
          fetchButton.disabled = false;
          setButtonLabel(fetchButton, "Fetch ranked maps");
          count.textContent = "0 DIFFICULTIES";
          return;
        }
        if (resolution.kind === "empty") {
          status.error("Enter a player name, ScoreSaber ID, or profile URL.");
          playerInput.focus();
          return;
        }
        if (resolution.kind === "too-short") {
          status.error("Player names must be at least 3 characters long.");
          playerInput.focus();
          return;
        }
        playerId = resolution.playerId;
        player = resolution.player;
      }

      if (playerQuery) playerPicker.reset();

      const playedLeaderboardIds = new Set<string>();
      if (playerId) {
        const firstScores = await fetchScorePage(playerId, 1);
        if (requestId !== activeRequest) return;
        const scorePages = Math.max(
          1,
          Number(firstScores.metadata?.totalPages) || 1,
        );
        status.show(`Checking your scores... page 1 of ${scorePages}`);
        for (let page = 1; page <= scorePages; page += 1) {
          if (requestId !== activeRequest) return;
          if (page > 1) {
            await pause(PAGE_PAUSE_MS);
            if (requestId !== activeRequest) return;
          }
          const payload =
            page === 1 ? firstScores : await fetchScorePage(playerId, page);
          if (page > 1 && requestId !== activeRequest) return;
          for (const score of payload.data) {
            const id = score.leaderboard?.id;
            if (id !== undefined) playedLeaderboardIds.add(String(id));
          }
          if (page < scorePages) {
            status.show(`Checking your scores... page ${page + 1} of ${scorePages}`);
          }
        }
      }

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
          if (requestId !== activeRequest) return;
        } else {
          status.show(
            `Connected. Loading ${totalMaps.toLocaleString()} matching maps...`,
          );
        }
        const payload =
          page === 1
            ? firstPage
            : await fetchRankedMapPage(page, minimumStars, maximumStars);
        if (page > 1 && requestId !== activeRequest) return;
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

      const seen = new Set<string>();
      const collected: RankedEntry[] = [];
      for (const map of allMaps) {
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
          if (
            leaderboard.id !== undefined &&
            playedLeaderboardIds.has(String(leaderboard.id))
          )
            continue;
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
      fetchedMinimumStars = minimumStars;
      fetchedMaximumStars = maximumStars;
      fetchedFilterLabel = playerId
        ? player?.name || player?.playerNameInGame || `player ${playerId}`
        : null;
      render();
      fetchButton.disabled = false;
      setButtonLabel(fetchButton, "Refresh ranked maps");
      status.hide();
      resultsTitle.textContent = "Ranked maps ready.";
      resultsSubtitle.textContent = `${entries.length.toLocaleString()} difficulties across ${uniqueMapCount().toLocaleString()} matching maps (${allMaps.length.toLocaleString()} maps scanned)${fetchedFilterLabel ? `; played difficulties hidden for ${fetchedFilterLabel}` : ""}.`;
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
    const low = fetchedMinimumStars.toFixed(1);
    const high = fetchedMaximumStars.toFixed(1);
    const mapCount = uniqueMapCount();
    const filterDescription = fetchedFilterLabel
      ? ` Hidden: difficulties already played by ${fetchedFilterLabel}.`
      : "";
    const playlist: Playlist = {
      playlistTitle: fetchedFilterLabel
        ? `Ranked Maps ${low}-${high} Stars (unplayed by ${fetchedFilterLabel})`
        : `Ranked Maps ${low}-${high} Stars`,
      playlistAuthor: "Cirzzo's Playlist Maker",
      playlistDescription: (split
        ? `${entries.length} ranked difficulties as separate entries across ${mapCount} maps.`
        : `${entries.length} ranked difficulties grouped across ${mapCount} maps.`) +
        filterDescription,
      songs: buildSongs(
        entries.map((e) => ({ map: e.map, difficulty: e.leaderboard })),
        split,
      ),
      coverImage: "",
      allowDuplicates: split,
    };
    const filename = fetchedFilterLabel
      ? `ranked-maps-${low}-${high}-stars-unplayed-${slugify(fetchedFilterLabel)}.bplist`
      : `ranked-maps-${low}-${high}-stars.bplist`;
    downloadPlaylist(playlist, filename);
  }
}
