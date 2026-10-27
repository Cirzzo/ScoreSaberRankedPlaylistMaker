import { $, errorMessage, pause, setButtonLabel, setTitle } from "./dom";
import { fetchPlayersByName, fetchScorePage, PAGE_PAUSE_MS } from "./api";
import {
  buildSongs,
  downloadPlaylist,
  slugify,
  type Playlist,
} from "./playlist";
import { RangeSlider, STAR_SLIDER } from "./slider";
import { StatusLine, createTrackRow } from "./ui";
import type {
  DifficultyInfo,
  Leaderboard,
  MapInfo,
  Player,
  Score,
} from "./types";

interface ScoreItem {
  /** Percentage, 0–100 */
  accuracy: number;
  stars: number;
  map: MapInfo;
  leaderboard: Leaderboard;
  score: Score;
  difficulty: DifficultyInfo;
}

export function initAccuracyTool(): void {
  const form = $<HTMLFormElement>("#player-form");
  const playerInput = $<HTMLInputElement>("#player-input");
  const playerMatch = $("#player-match");
  const playerMatchSelect = $<HTMLSelectElement>("#player-match-select");
  const buildButton = $<HTMLButtonElement>("#build-button");
  const sizeSlider = $<HTMLInputElement>("#size-slider");
  const sizeOutput = $("#size-output");
  const trackList = $("#track-list");
  const emptyState = $("#empty-state");
  const trackCount = $("#track-count");
  const downloadButton = $<HTMLButtonElement>("#download-button");
  const resultsTitle = $("#results-title");
  const resultsSubtitle = $("#results-subtitle");
  const playerCard = $("#player-card");
  const playerAvatar = $("#player-avatar");
  const playerName = $("#player-name");
  const playerSubtitle = $("#player-subtitle");
  const playerLink = $<HTMLAnchorElement>("#player-link");
  const limitNote = $("#limit-note");
  const status = new StatusLine($("#status-line"), $("#status-text"));

  let allScores: ScoreItem[] = [];
  let currentPlayerId = "";
  let currentPlayer: Player | null = null;
  let loadedPlayerId = "";
  let activeRequest = 0;
  let refreshTimer = 0;
  let matchedPlayers: Player[] = [];
  let matchedPlayerQuery = "";

  // Changing a filter after a profile is loaded re-runs the scan (debounced).
  const scheduleRefresh = (): void => {
    if (!loadedPlayerId) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => form.requestSubmit(), 350);
  };

  const stars = new RangeSlider({
    ...STAR_SLIDER,
    root: $("#star-range-control"),
    fill: $("#star-range-fill"),
    minHandle: $("#star-min-handle"),
    maxHandle: $("#star-max-handle"),
    output: $("#star-range-output"),
    low: 0,
    high: 10,
    onChange: scheduleRefresh,
  });

  const accuracy = new RangeSlider({
    root: $("#accuracy-range-control"),
    fill: $("#accuracy-range-fill"),
    minHandle: $("#accuracy-min-handle"),
    maxHandle: $("#accuracy-max-handle"),
    output: $("#accuracy-range-output"),
    min: 0,
    max: 100,
    step: 1,
    pageStep: 5,
    decimals: 0,
    low: 0,
    high: 95,
    formatRange: (low, high) => `${low}% - ${high}%`,
    valueText: (value, label) => `${value}% ${label}`,
    onChange: scheduleRefresh,
  });

  sizeSlider.addEventListener("input", () => {
    sizeOutput.textContent = sizeSlider.value;
    renderTracks();
  });

  playerInput.addEventListener("input", () => {
    matchedPlayers = [];
    matchedPlayerQuery = "";
    playerMatchSelect.replaceChildren();
    playerMatch.hidden = true;
  });

  downloadButton.addEventListener("click", download);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleSubmit();
  });

  async function handleSubmit(): Promise<void> {
    const playerQuery = playerInput.value.trim();
    if (!playerQuery) {
      status.error("Enter a player name, ScoreSaber ID, or profile URL.");
      playerInput.focus();
      return;
    }

    let playerId = extractPlayerId(playerQuery);
    let resolvedPlayer: Player | null = null;
    if (!playerId && matchedPlayerQuery === playerQuery) {
      resolvedPlayer =
        matchedPlayers.find((p) => p.id === playerMatchSelect.value) ?? null;
      playerId = resolvedPlayer?.id ?? "";
    }
    if (!playerId && playerQuery.length < 3) {
      status.error("Player names must be at least 3 characters long.");
      playerInput.focus();
      return;
    }

    const requestId = ++activeRequest;
    allScores = [];
    currentPlayer = null;
    playerCard.hidden = true;
    limitNote.hidden = true;
    trackList.replaceChildren();
    setLoading(true);
    status.show(
      playerId
        ? "Connecting to ScoreSaber..."
        : "Searching ScoreSaber players...",
    );
    setTitle(
      resultsTitle,
      playerId ? "Fetching your scores" : "Searching player names",
    );
    resultsSubtitle.textContent = playerId
      ? "Loading scores..."
      : "Searching players...";
    trackCount.textContent = "... MAPS";
    downloadButton.disabled = true;

    try {
      if (!playerId) {
        const matches = await fetchPlayersByName(playerQuery);
        if (requestId !== activeRequest) return;
        const wanted = playerQuery.toLocaleLowerCase();
        const exactMatches = matches.filter((player) =>
          [player.name, player.playerNameInGame].some(
            (name) => name?.trim().toLocaleLowerCase() === wanted,
          ),
        );
        if (exactMatches.length === 1) {
          resolvedPlayer = exactMatches[0] ?? null;
        } else if (matches.length === 1) {
          resolvedPlayer = matches[0] ?? null;
        } else if (matches.length === 0) {
          throw new Error(`No ScoreSaber players found for “${playerQuery}”.`);
        } else {
          const choices = exactMatches.length ? exactMatches : matches;
          showPlayerMatches(playerQuery, choices);
          setLoading(false);
          status.show(
            "More than one player matched. Choose a profile, then fetch scores again.",
          );
          setTitle(resultsTitle, "Choose a player");
          resultsSubtitle.textContent = `${choices.length} matching profiles found.`;
          trackCount.textContent = "0 MAPS";
          return;
        }
        playerId = resolvedPlayer?.id ?? "";
      }

      playerMatch.hidden = true;
      matchedPlayerQuery = "";
      matchedPlayers = [];
      currentPlayerId = playerId;
      currentPlayer = resolvedPlayer;
      status.show("Connecting to ScoreSaber...");
      setTitle(resultsTitle, "Fetching your scores");
      resultsSubtitle.textContent = "Loading scores...";

      const firstPage = await fetchScorePage(playerId, 1);
      if (requestId !== activeRequest) return;

      const totalPages = Math.max(
        1,
        Number(firstPage.metadata?.totalPages) || 1,
      );
      const totalItems = Number(firstPage.metadata?.totalItems) || 0;
      setTitle(resultsTitle, "Connected to ScoreSaber");
      resultsSubtitle.textContent = totalItems
        ? `Found ${totalItems.toLocaleString()} scores. Filtering ranked maps...`
        : "Connected. Filtering ranked maps...";

      const requestedCount = Number(sizeSlider.value);
      const minStars = stars.low;
      const maxStars = stars.high;
      const minAccuracy = accuracy.low;
      const maxAccuracy = accuracy.high;
      const scores: ScoreItem[] = [];
      const seen = new Set<string>();
      let pagesScanned = 0;

      // Scores are sorted by accuracy ascending, so scan from the last page backwards.
      for (
        let page = totalPages;
        page >= 1 && scores.length < requestedCount;
        page -= 1
      ) {
        if (requestId !== activeRequest) return;
        status.show(
          `Scanning page ${pagesScanned + 1} of up to ${totalPages}; ${scores.length} of ${requestedCount} maps matched.`,
        );
        if (page !== totalPages && page !== 1) await pause(PAGE_PAUSE_MS);
        const payload =
          page === 1 ? firstPage : await fetchScorePage(playerId, page);
        pagesScanned += 1;

        for (const entry of payload.data) {
          const score = entry.score ?? {};
          const board = entry.leaderboard ?? {};
          if (board.realm?.leaderboardStatus !== "RANKED") continue;
          if (score.personalBest !== true) continue;
          const map = board.map;
          if (!map?.hash) continue;
          const acc = Number(score.accuracy);
          const starValue = Number(board.realm?.stars);
          if (
            !Number.isFinite(acc) ||
            acc < 0 ||
            acc > 1 ||
            acc * 100 < minAccuracy ||
            acc * 100 > maxAccuracy ||
            !Number.isFinite(starValue) ||
            starValue < minStars ||
            starValue > maxStars
          )
            continue;
          const key = String(map.hash).toUpperCase();
          if (seen.has(key)) continue;
          seen.add(key);
          scores.push({
            accuracy: acc * 100,
            stars: starValue,
            map,
            leaderboard: board,
            score,
            difficulty: board.difficulty ?? {},
          });
        }
        status.show(
          `Scanned ${pagesScanned} of ${totalPages} pages; ${Math.min(scores.length, requestedCount)} of ${requestedCount} maps matched.`,
        );
      }

      if (requestId !== activeRequest) return;
      scores.sort((a, b) => a.accuracy - b.accuracy);

      allScores = scores;
      loadedPlayerId = playerId;
      currentPlayer =
        resolvedPlayer ??
        firstPage.data.map((entry) => entry.score?.player).find(Boolean) ??
        null;
      setLoading(false);
      status.hide();
      showPlayer(playerId, currentPlayer);
      renderTracks();

      const filterText = `${minAccuracy}%–${maxAccuracy}%, ${minStars.toFixed(1)}–${maxStars.toFixed(1)} stars`;
      if (scores.length === 0) {
        setTitle(resultsTitle, "No maps match these filters");
        resultsSubtitle.textContent =
          "Try widening the accuracy or star range.";
        status.show(
          "No ranked maps match the selected accuracy and star limits.",
        );
      } else {
        setTitle(resultsTitle, "Your next run starts here");
        resultsSubtitle.textContent =
          scores.length >= requestedCount
            ? `Showing ${requestedCount} lowest-accuracy matches (${filterText}).`
            : `Found ${scores.length} matches after scanning all ${pagesScanned} score pages (${filterText}).`;
      }
    } catch (error) {
      if (requestId !== activeRequest) return;
      setLoading(false);
      status.error(
        errorMessage(error, "Could not load this ScoreSaber profile."),
      );
      setTitle(resultsTitle, "Could not load profile");
      resultsSubtitle.textContent = "Check the player ID and try again.";
      trackCount.textContent = "0 MAPS";
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
    for (const player of players) {
      const option = document.createElement("option");
      option.value = player.id;
      const rank = player.stats?.rank ? `#${player.stats.rank}` : "Unranked";
      option.textContent = `${player.name ?? "Unknown"} · ${player.country || "--"} · ${rank} · ${player.id}`;
      playerMatchSelect.append(option);
    }
    playerMatch.hidden = false;
  }

  function showPlayer(playerId: string, player: Player | null): void {
    playerCard.hidden = false;
    const name =
      player?.name || player?.playerNameInGame || `Player ${playerId}`;
    playerName.textContent = name;
    playerSubtitle.textContent = player?.country
      ? `${player.country} / ScoreSaber`
      : "ScoreSaber profile";
    playerLink.href = `https://scoresaber.com/u/${encodeURIComponent(playerId)}`;
    if (player?.avatar) {
      const image = document.createElement("img");
      image.src = player.avatar;
      image.alt = "";
      image.addEventListener(
        "error",
        () => playerAvatar.replaceChildren(document.createTextNode("SS")),
        { once: true },
      );
      playerAvatar.replaceChildren(image);
    } else {
      playerAvatar.replaceChildren(
        document.createTextNode((name[0] || "S").toUpperCase()),
      );
    }
  }

  function getSelectedMaps(): ScoreItem[] {
    return allScores
      .filter(
        (s) =>
          s.stars >= stars.low &&
          s.stars <= stars.high &&
          s.accuracy >= accuracy.low &&
          s.accuracy <= accuracy.high,
      )
      .slice(0, Number(sizeSlider.value));
  }

  function renderTracks(): void {
    if (!allScores.length) {
      if (!trackList.contains(emptyState))
        trackList.replaceChildren(emptyState);
      trackCount.textContent = "0 MAPS";
      downloadButton.disabled = true;
      return;
    }
    const selected = getSelectedMaps();
    trackList.replaceChildren(...selected.map(createRow));
    trackCount.textContent = `${selected.length} MAP${selected.length === 1 ? "" : "S"}`;
    downloadButton.disabled = false;
    limitNote.hidden = true;
  }

  function createRow(item: ScoreItem, index: number): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "accuracy-cell";
    cell.textContent = `${item.accuracy.toFixed(2)}%`;
    const label = document.createElement("small");
    label.textContent = `${item.stars.toFixed(1)} STARS`;
    cell.append(label);
    const row = createTrackRow(item.map, item.difficulty, cell);
    row.style.animationDelay = `${Math.min(index, 12) * 24}ms`;
    return row;
  }

  function setLoading(isLoading: boolean): void {
    buildButton.disabled = isLoading;
    setButtonLabel(buildButton, isLoading ? "Fetching..." : "Fetch scores");
  }

  function download(): void {
    const selected = getSelectedMaps();
    if (!selected.length) return;
    const playerLabel = currentPlayer?.name || `Player ${currentPlayerId}`;
    const accLow = accuracy.low.toFixed(2);
    const accHigh = accuracy.high.toFixed(2);
    const starsLow = stars.low.toFixed(1);
    const starsHigh = stars.high.toFixed(1);
    const playlist: Playlist = {
      playlistTitle: `${playerLabel} - Lowest Accuracy ${accLow}% to ${accHigh}%`,
      playlistAuthor: "Cirzzo's Playlist Maker",
      playlistDescription: `${selected.length} lowest-accuracy ranked maps from ${accLow}% to ${accHigh}% accuracy and ${starsLow} to ${starsHigh} stars.`,
      songs: buildSongs(
        selected.map((s) => ({ map: s.map, difficulty: s.difficulty })),
        false,
      ),
      coverImage: "",
      allowDuplicates: false,
    };
    downloadPlaylist(
      playlist,
      `${slugify(playerLabel)}-lowest-accuracy.bplist`,
    );
  }
}
