const API_ROOT = (
  window.SCORESABER_API_ROOT || "https://scoresaber.com/api/v2"
).replace(/\/+$/, "");
const PAGE_SIZE = 100;
const PAGE_PAUSE_MS = 180;
const REQUEST_TIMEOUT_MS = 15000;

const form = document.querySelector("#player-form");
const playerInput = document.querySelector("#player-input");
const playerMatch = document.querySelector("#player-match");
const playerMatchSelect = document.querySelector("#player-match-select");
const buildButton = document.querySelector("#build-button");
const sizeSlider = document.querySelector("#size-slider");
const sizeOutput = document.querySelector("#size-output");
const accuracyRangeControl = document.querySelector("#accuracy-range-control");
const accuracyRangeFill = document.querySelector("#accuracy-range-fill");
const accuracyMinHandle = document.querySelector("#accuracy-min-handle");
const accuracyMaxHandle = document.querySelector("#accuracy-max-handle");
const accuracyRangeOutput = document.querySelector("#accuracy-range-output");
const starRangeControl = document.querySelector("#star-range-control");
const starRangeFill = document.querySelector("#star-range-fill");
const starMinHandle = document.querySelector("#star-min-handle");
const starMaxHandle = document.querySelector("#star-max-handle");
const starRangeOutput = document.querySelector("#star-range-output");
const trackList = document.querySelector("#track-list");
const emptyState = document.querySelector("#empty-state");
const trackCount = document.querySelector("#track-count");
const downloadButton = document.querySelector("#download-button");
const resultsTitle = document.querySelector("#results-title");
const resultsSubtitle = document.querySelector("#results-subtitle");
const statusLine = document.querySelector("#status-line");
const statusText = document.querySelector("#status-text");
const playerCard = document.querySelector("#player-card");
const playerAvatar = document.querySelector("#player-avatar");
const playerName = document.querySelector("#player-name");
const playerSubtitle = document.querySelector("#player-subtitle");
const playerLink = document.querySelector("#player-link");
const limitNote = document.querySelector("#limit-note");
const utilityLinks = [...document.querySelectorAll("[data-utility-link]")];
const utilityViews = [...document.querySelectorAll("[data-utility-view]")];
const rankedForm = document.querySelector("#ranked-form");
const rankedFetchButton = document.querySelector("#ranked-fetch-button");
const rankedStarRangeControl = document.querySelector(
  "#ranked-star-range-control",
);
const rankedStarRangeFill = document.querySelector("#ranked-star-range-fill");
const rankedStarMinHandle = document.querySelector("#ranked-star-min-handle");
const rankedStarMaxHandle = document.querySelector("#ranked-star-max-handle");
const rankedStarRangeOutput = document.querySelector(
  "#ranked-star-range-output",
);
const rankedResultsTitle = document.querySelector("#ranked-results-title");
const rankedResultsSubtitle = document.querySelector(
  "#ranked-results-subtitle",
);
const rankedCount = document.querySelector("#ranked-count");
const rankedDownloadButton = document.querySelector("#ranked-download-button");
const rankedStatusLine = document.querySelector("#ranked-status-line");
const rankedStatusText = document.querySelector("#ranked-status-text");
const rankedTrackList = document.querySelector("#ranked-track-list");
const rankedEmptyState = document.querySelector("#ranked-empty-state");

let allScores = [];
let currentPlayerId = "";
let currentPlayer = null;
let activeRequest = 0;
let loadedPlayerId = "";
let starRangeRefreshTimer = 0;
let activeStarHandle = null;
let activeStarPointerId = null;
let minimumStars = 0;
let maximumStars = 10;
let minimumAccuracy = 0;
let maximumAccuracy = 95;
let activeAccuracyHandle = null;
let activeAccuracyPointerId = null;
let matchedPlayers = [];
let matchedPlayerQuery = "";
let rankedEntries = [];
let rankedMinimumStars = 0;
let rankedMaximumStars = 10;
let activeRankedStarHandle = null;
let activeRankedStarPointerId = null;
let activeRankedRequest = 0;

sizeSlider.addEventListener("input", () => {
  sizeOutput.value = sizeSlider.value;
  sizeOutput.textContent = sizeSlider.value;
  renderTracks();
});

starRangeControl.addEventListener("pointerdown", handleStarPointerDown);
starRangeControl.addEventListener("pointermove", handleStarPointerMove);
starRangeControl.addEventListener("pointerup", endStarPointerDrag);
starRangeControl.addEventListener("pointercancel", endStarPointerDrag);
starMinHandle.addEventListener("keydown", handleStarKeydown);
starMaxHandle.addEventListener("keydown", handleStarKeydown);
updateStarRangeDisplay();
accuracyRangeControl.addEventListener("pointerdown", handleAccuracyPointerDown);
accuracyRangeControl.addEventListener("pointermove", handleAccuracyPointerMove);
accuracyRangeControl.addEventListener("pointerup", endAccuracyPointerDrag);
accuracyRangeControl.addEventListener("pointercancel", endAccuracyPointerDrag);
accuracyMinHandle.addEventListener("keydown", handleAccuracyKeydown);
accuracyMaxHandle.addEventListener("keydown", handleAccuracyKeydown);
updateAccuracyRangeDisplay();

utilityLinks.forEach((link) =>
  link.addEventListener("click", () => {
    const utility = link.dataset.utilityLink;
    window.location.hash =
      utility === "ranked" ? "ranked-maps" : "lowest-accuracy";
  }),
);
window.addEventListener("hashchange", updateUtilityNavigation);
updateUtilityNavigation();

rankedStarRangeControl.addEventListener(
  "pointerdown",
  handleRankedStarPointerDown,
);
rankedStarRangeControl.addEventListener(
  "pointermove",
  handleRankedStarPointerMove,
);
rankedStarRangeControl.addEventListener("pointerup", endRankedStarPointerDrag);
rankedStarRangeControl.addEventListener(
  "pointercancel",
  endRankedStarPointerDrag,
);
rankedStarMinHandle.addEventListener("keydown", handleRankedStarKeydown);
rankedStarMaxHandle.addEventListener("keydown", handleRankedStarKeydown);
updateRankedStarRangeDisplay();

rankedForm.addEventListener("submit", fetchAllRankedMaps);
rankedDownloadButton.addEventListener("click", downloadRankedPlaylist);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const playerQuery = playerInput.value.trim();
  let playerId = extractPlayerId(playerQuery);
  let resolvedPlayer = null;
  if (!playerQuery) {
    showError("Enter a player name, ScoreSaber ID, or profile URL.");
    playerInput.focus();
    return;
  }
  if (!playerId && matchedPlayerQuery === playerQuery) {
    resolvedPlayer = matchedPlayers.find(
      (player) => player.id === playerMatchSelect.value,
    );
    playerId = resolvedPlayer?.id ?? "";
  }
  if (!playerId && playerQuery.length < 3) {
    showError("Player names must be at least 3 characters long.");
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
  setStatus(
    playerId
      ? "Connecting to ScoreSaber..."
      : "Searching ScoreSaber players...",
  );
  resultsTitle.innerHTML = `${playerId ? "Fetching your scores" : "Searching player names"}<span class="title-period">.</span>`;
  resultsSubtitle.textContent = playerId
    ? "Loading scores..."
    : "Searching players...";
  trackCount.textContent = "... MAPS";
  downloadButton.disabled = true;

  try {
    if (!playerId) {
      const matches = await fetchPlayersByName(playerQuery);
      if (requestId !== activeRequest) return;
      const exactMatches = matches.filter((player) =>
        [player.name, player.playerNameInGame].some(
          (name) =>
            name?.trim().toLocaleLowerCase() ===
            playerQuery.toLocaleLowerCase(),
        ),
      );
      if (exactMatches.length === 1) {
        resolvedPlayer = exactMatches[0];
      } else if (matches.length === 1) {
        resolvedPlayer = matches[0];
      } else if (matches.length === 0) {
        throw new Error(`No ScoreSaber players found for “${playerQuery}”.`);
      } else {
        showPlayerMatches(
          playerQuery,
          exactMatches.length ? exactMatches : matches,
        );
        setLoading(false);
        setStatus(
          "More than one player matched. Choose a profile, then fetch scores again.",
        );
        resultsTitle.innerHTML =
          'Choose a player<span class="title-period">.</span>';
        resultsSubtitle.textContent = `${exactMatches.length || matches.length} matching profiles found.`;
        trackCount.textContent = "0 MAPS";
        return;
      }
      playerId = resolvedPlayer.id;
    }

    playerMatch.hidden = true;
    matchedPlayerQuery = "";
    matchedPlayers = [];
    currentPlayerId = playerId;
    currentPlayer = resolvedPlayer;
    setStatus("Connecting to ScoreSaber...");
    resultsTitle.innerHTML =
      'Fetching your scores<span class="title-period">.</span>';
    resultsSubtitle.textContent = "Loading scores...";

    const firstPage = await fetchScorePage(playerId, 1);
    if (requestId !== activeRequest) return;

    const totalPages = Math.max(1, Number(firstPage.metadata?.totalPages) || 1);
    const totalItems = Number(firstPage.metadata?.totalItems) || 0;
    resultsTitle.innerHTML =
      'Connected to ScoreSaber<span class="title-period">.</span>';
    resultsSubtitle.textContent = totalItems
      ? `Found ${totalItems.toLocaleString()} scores. Filtering ranked maps...`
      : "Connected. Filtering ranked maps...";
    const scores = [];
    const seen = new Set();
    const requestedCount = Number(sizeSlider.value);
    const requestedMinimumStars = minimumStars;
    const requestedMaximumStars = maximumStars;
    const requestedMinimumAccuracy = minimumAccuracy;
    const requestedMaximumAccuracy = maximumAccuracy;
    for (
      let page = totalPages;
      page >= 1 && scores.length < requestedCount;
      page -= 1
    ) {
      if (requestId !== activeRequest) return;
      setStatus(
        `Checking lowest-accuracy ranked scores... page ${page} of ${totalPages}`,
      );
      if (page !== totalPages && page !== 1) await pause(PAGE_PAUSE_MS);
      const payload =
        page === 1 ? firstPage : await fetchScorePage(playerId, page);
      for (const entry of payload.data ?? []) {
        const score = entry.score ?? {};
        const board = entry.leaderboard ?? {};
        const accuracy = Number(score.accuracy);
        const stars = Number(board.realm?.stars);
        if (
          board.realm?.leaderboardStatus !== "RANKED" ||
          score.personalBest !== true
        )
          continue;
        if (
          !board.map?.hash ||
          !Number.isFinite(accuracy) ||
          accuracy < 0 ||
          accuracy > 1 ||
          accuracy * 100 < requestedMinimumAccuracy ||
          accuracy * 100 > requestedMaximumAccuracy ||
          !Number.isFinite(stars) ||
          stars < requestedMinimumStars ||
          stars > requestedMaximumStars
        )
          continue;
        const key = String(board.map.hash).toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        scores.push(normalizeScore(entry));
      }
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
    hideStatus();
    showPlayer(playerId, currentPlayer);
    renderTracks();

    if (scores.length === 0) {
      resultsTitle.innerHTML =
        'No maps match these filters<span class="title-period">.</span>';
      resultsSubtitle.textContent = "Try widening the accuracy or star range.";
      setStatus("No ranked maps match the selected accuracy and star limits.");
    } else {
      resultsTitle.innerHTML =
        'Your next run starts here<span class="title-period">.</span>';
      resultsSubtitle.textContent = `${scores.length} ranked maps at ${requestedMinimumAccuracy}%–${requestedMaximumAccuracy}% accuracy and ${requestedMinimumStars.toFixed(1)}–${requestedMaximumStars.toFixed(1)} stars.`;
    }
  } catch (error) {
    if (requestId !== activeRequest) return;
    setLoading(false);
    showError(error.message || "Could not load this ScoreSaber profile.");
    resultsTitle.innerHTML =
      'Could not load profile<span class="title-period">.</span>';
    resultsSubtitle.textContent = "Check the player ID and try again.";
    trackCount.textContent = "0 MAPS";
  }
});

playerInput.addEventListener("input", () => {
  matchedPlayers = [];
  matchedPlayerQuery = "";
  playerMatchSelect.replaceChildren();
  playerMatch.hidden = true;
});

downloadButton.addEventListener("click", downloadPlaylist);

function updateUtilityNavigation() {
  const utility =
    window.location.hash === "#ranked-maps" ? "ranked" : "accuracy";
  for (const view of utilityViews) {
    view.hidden = view.dataset.utilityView !== utility;
  }
  for (const link of utilityLinks) {
    if (link.dataset.utilityLink === utility) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
  document.title =
    utility === "ranked"
      ? "Ranked Maps Playlist | ScoreSaber Playlist Tools"
      : "Lowest Accuracy Playlist | ScoreSaber Playlist Tools";
}

async function fetchAllRankedMaps(event) {
  event.preventDefault();
  const requestId = ++activeRankedRequest;
  const minimumStars = rankedMinimumStars;
  const maximumStars = rankedMaximumStars;
  rankedEntries = [];
  rankedTrackList.replaceChildren();
  rankedFetchButton.disabled = true;
  rankedFetchButton.querySelector("span").textContent = "Fetching maps...";
  rankedDownloadButton.disabled = true;
  rankedCount.textContent = "... DIFFICULTIES";
  rankedResultsTitle.textContent = "Fetching ranked maps...";
  rankedResultsSubtitle.textContent = `Loading ${minimumStars.toFixed(1)}-${maximumStars.toFixed(1)} stars...`;
  setRankedStatus("Connecting to ScoreSaber ranked maps...");

  try {
    const firstPage = await fetchRankedMapPage(1, minimumStars, maximumStars);
    if (requestId !== activeRankedRequest) return;
    const totalPages = Math.max(1, Number(firstPage.metadata?.totalPages) || 1);
    const totalMaps = Number(firstPage.metadata?.totalItems) || 0;
    const allMaps = [];
    for (let page = 1; page <= totalPages; page += 1) {
      if (requestId !== activeRankedRequest) return;
      if (page > 1) {
        setRankedStatus(`Loading ranked maps... page ${page} of ${totalPages}`);
        await pause(PAGE_PAUSE_MS);
      } else {
        setRankedStatus(
          `Connected. Loading ${totalMaps.toLocaleString()} matching maps...`,
        );
      }
      const payload =
        page === 1
          ? firstPage
          : await fetchRankedMapPage(page, minimumStars, maximumStars);
      allMaps.push(...(payload.data ?? []));
    }

    const seen = new Set();
    rankedEntries = allMaps
      .flatMap((map) =>
        (map.leaderboards ?? [])
          .filter((leaderboard) => {
            const stars = Number(leaderboard.realm?.stars);
            if (
              leaderboard.realm?.leaderboardStatus !== "RANKED" ||
              !Number.isFinite(stars) ||
              stars < minimumStars ||
              stars > maximumStars
            )
              return false;
            const key = String(
              leaderboard.id ??
                `${map.hash}:${leaderboard.gameMode}:${leaderboard.rawDifficulty}`,
            );
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((leaderboard) => ({
            map,
            leaderboard,
            stars: Number(leaderboard.realm.stars),
          })),
      )
      .sort(
        (left, right) =>
          left.stars - right.stars ||
          left.map.songName.localeCompare(right.map.songName),
      );

    if (requestId !== activeRankedRequest) return;
    renderRankedMaps();
    rankedFetchButton.disabled = false;
    rankedFetchButton.querySelector("span").textContent = "Refresh ranked maps";
    hideRankedStatus();
    const uniqueMaps = new Set(rankedEntries.map((entry) => entry.map.hash))
      .size;
    rankedResultsTitle.textContent = "Ranked maps ready.";
    rankedResultsSubtitle.textContent = `${uniqueMaps.toLocaleString()} maps with ${rankedEntries.length.toLocaleString()} ranked difficulties from ${minimumStars.toFixed(1)} to ${maximumStars.toFixed(1)} stars.`;
  } catch (error) {
    if (requestId !== activeRankedRequest) return;
    rankedFetchButton.disabled = false;
    rankedFetchButton.querySelector("span").textContent = "Retry ranked maps";
    rankedCount.textContent = "0 DIFFICULTIES";
    rankedResultsTitle.textContent = "Could not load ranked maps.";
    rankedResultsSubtitle.textContent = "Retry the request.";
    setRankedError(
      error.message || "Could not load ranked maps from ScoreSaber.",
    );
  }
}

async function fetchRankedMapPage(page, minimumStars, maximumStars) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    status: "RANKED",
    minStars: String(minimumStars),
    maxStars: String(maximumStars),
    sortBy: "highestStars",
    sortDirection: "asc",
  });
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  let response;
  try {
    response = await fetch(`${API_ROOT}/maps?${query}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "ScoreSaber did not respond within 15 seconds. Try again.",
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach ScoreSaber. Check your internet connection and try again.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  if (response.status === 429)
    throw new Error("ScoreSaber is rate limiting requests. Wait, then retry.");
  if (!response.ok)
    throw new Error(`ScoreSaber returned an error (${response.status}).`);
  const body = await response.json();
  if (!Array.isArray(body.data))
    throw new Error("ScoreSaber returned an unexpected ranked maps response.");
  return body;
}

function renderRankedMaps() {
  if (!rankedEntries.length) {
    rankedTrackList.replaceChildren(rankedEmptyState);
    rankedCount.textContent = "0 DIFFICULTIES";
    rankedDownloadButton.disabled = true;
    return;
  }
  const fragment = document.createDocumentFragment();
  rankedEntries.forEach((entry) => fragment.append(createRankedMapRow(entry)));
  rankedTrackList.replaceChildren(fragment);
  rankedCount.textContent = `${rankedEntries.length.toLocaleString()} DIFFICULTIES`;
  rankedDownloadButton.disabled = false;
}

function createRankedMapRow(entry) {
  const { map, leaderboard, stars } = entry;
  const row = document.createElement("article");
  row.className = "track-row ranked-track-row";
  const main = document.createElement("div");
  main.className = "track-main";
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
  const copy = document.createElement("div");
  copy.className = "track-copy";
  const name = document.createElement("div");
  name.className = "track-name";
  name.textContent = map.songName || "Unknown track";
  const author = document.createElement("div");
  author.className = "track-author";
  author.textContent =
    map.songAuthorName || map.levelAuthorName || "Unknown artist";
  copy.append(name, author);
  main.append(cover, copy);
  const difficulty = document.createElement("div");
  difficulty.className = "difficulty-cell";
  const dot = document.createElement("span");
  dot.className = `difficulty-dot ${difficultyClass(leaderboard.rawDifficulty)}`;
  const difficultyName = document.createElement("span");
  difficultyName.className = "difficulty-text";
  const formatted = formatPlaylistDifficulty(leaderboard);
  difficultyName.textContent = `${formatted.characteristic} / ${formatted.name}`;
  difficulty.append(dot, difficultyName);
  const starLabel = document.createElement("div");
  starLabel.className = "accuracy-cell ranked-stars-cell";
  starLabel.textContent = `${stars.toFixed(2)}★`;
  row.append(main, difficulty, starLabel);
  return row;
}

function downloadRankedPlaylist() {
  if (!rankedEntries.length) return;
  const songsByHash = new Map();
  for (const { map, leaderboard } of rankedEntries) {
    const hash = String(map.hash).toUpperCase();
    if (!songsByHash.has(hash)) {
      songsByHash.set(hash, {
        key: hash,
        hash,
        songName: map.songName || "Unknown track",
        levelAuthorName: map.levelAuthorName || "Unknown mapper",
        difficulties: [],
      });
    }
    const song = songsByHash.get(hash);
    const difficulty = formatPlaylistDifficulty(leaderboard);
    if (
      !song.difficulties.some(
        (item) =>
          item.name === difficulty.name &&
          item.characteristic === difficulty.characteristic,
      )
    ) {
      song.difficulties.push(difficulty);
    }
  }
  const uniqueMapCount = songsByHash.size;
  const playlist = {
    playlistTitle: `Ranked Maps ${rankedMinimumStars.toFixed(1)}-${rankedMaximumStars.toFixed(1)} Stars`,
    playlistAuthor: "ScoreSaber Playlist Tools",
    playlistDescription: `${rankedEntries.length} ranked difficulties across ${uniqueMapCount} maps from ${rankedMinimumStars.toFixed(1)} to ${rankedMaximumStars.toFixed(1)} stars.`,
    songs: [...songsByHash.values()],
    coverImage: "",
    allowDuplicates: false,
  };
  const blob = new Blob([JSON.stringify(playlist, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ranked-maps-${rankedMinimumStars.toFixed(1)}-${rankedMaximumStars.toFixed(1)}-stars.bplist`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setRankedStatus(message) {
  rankedStatusLine.hidden = false;
  rankedStatusLine.classList.remove("is-error");
  rankedStatusText.textContent = message;
}

function setRankedError(message) {
  rankedStatusLine.hidden = false;
  rankedStatusLine.classList.add("is-error");
  rankedStatusText.textContent = message;
}

function hideRankedStatus() {
  rankedStatusLine.hidden = true;
  rankedStatusLine.classList.remove("is-error");
}

function handleRankedStarPointerDown(event) {
  const handle = event.target.closest("[data-ranked-star-handle]");
  if (handle) {
    activeRankedStarHandle = handle;
  } else {
    const value = rankedStarValueFromPointer(event);
    activeRankedStarHandle =
      Math.abs(value - rankedMinimumStars) <=
      Math.abs(value - rankedMaximumStars)
        ? rankedStarMinHandle
        : rankedStarMaxHandle;
    setRankedStarHandleValue(activeRankedStarHandle, value);
  }
  activeRankedStarPointerId = event.pointerId;
  rankedStarRangeControl.setPointerCapture(event.pointerId);
  activeRankedStarHandle.focus();
  event.preventDefault();
}

function handleRankedStarPointerMove(event) {
  if (!activeRankedStarHandle || event.pointerId !== activeRankedStarPointerId)
    return;
  setRankedStarHandleValue(
    activeRankedStarHandle,
    rankedStarValueFromPointer(event),
  );
}

function endRankedStarPointerDrag(event) {
  if (event.pointerId !== activeRankedStarPointerId) return;
  activeRankedStarHandle = null;
  activeRankedStarPointerId = null;
}

function rankedStarValueFromPointer(event) {
  const bounds = rankedStarRangeControl.getBoundingClientRect();
  return clampStarValue(((event.clientX - bounds.left) / bounds.width) * 20);
}

function handleRankedStarKeydown(event) {
  const handle = event.currentTarget;
  const minimumHandle = handle === rankedStarMinHandle;
  const currentValue = minimumHandle ? rankedMinimumStars : rankedMaximumStars;
  const nextValues = {
    ArrowLeft: currentValue - 0.1,
    ArrowDown: currentValue - 0.1,
    ArrowRight: currentValue + 0.1,
    ArrowUp: currentValue + 0.1,
    PageDown: currentValue - 1,
    PageUp: currentValue + 1,
    Home: 0,
    End: 20,
  };
  if (!(event.key in nextValues)) return;
  event.preventDefault();
  setRankedStarHandleValue(handle, nextValues[event.key]);
}

function setRankedStarHandleValue(handle, value) {
  const nextValue = clampStarValue(value);
  if (handle === rankedStarMinHandle) {
    rankedMinimumStars = Math.min(nextValue, rankedMaximumStars);
  } else {
    rankedMaximumStars = Math.max(nextValue, rankedMinimumStars);
  }
  updateRankedStarRangeDisplay();
}

function updateRankedStarRangeDisplay() {
  rankedStarRangeOutput.value = `${rankedMinimumStars.toFixed(1)} - ${rankedMaximumStars.toFixed(1)} STARS`;
  rankedStarRangeOutput.textContent = rankedStarRangeOutput.value;
  rankedStarRangeFill.style.left = `${(rankedMinimumStars / 20) * 100}%`;
  rankedStarRangeFill.style.width = `${((rankedMaximumStars - rankedMinimumStars) / 20) * 100}%`;
  updateRankedStarHandle(
    rankedStarMinHandle,
    rankedMinimumStars,
    rankedMaximumStars,
    "minimum",
  );
  updateRankedStarHandle(
    rankedStarMaxHandle,
    rankedMaximumStars,
    rankedMinimumStars,
    "maximum",
  );
}

function updateRankedStarHandle(handle, value, bound, label) {
  handle.style.left = `${(value / 20) * 100}%`;
  handle.setAttribute("aria-valuemin", String(label === "minimum" ? 0 : bound));
  handle.setAttribute(
    "aria-valuemax",
    String(label === "minimum" ? bound : 20),
  );
  handle.setAttribute("aria-valuenow", value.toFixed(1));
  handle.setAttribute("aria-valuetext", `${value.toFixed(1)} stars ${label}`);
}

async function fetchPlayersByName(name) {
  const query = new URLSearchParams({
    page: "1",
    limit: "10",
    search: name,
  });
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  let response;
  try {
    response = await fetch(`${API_ROOT}/players?${query}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("ScoreSaber player search timed out. Please try again.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach ScoreSaber. Check your connection and try again.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  if (response.status === 429) {
    throw new Error("ScoreSaber is rate limiting requests. Wait, then retry.");
  }
  if (!response.ok) {
    throw new Error(`ScoreSaber player search failed (${response.status}).`);
  }
  const body = await response.json();
  if (!Array.isArray(body.data)) {
    throw new Error(
      "ScoreSaber returned an unexpected player search response.",
    );
  }
  return body.data;
}

function showPlayerMatches(query, players) {
  matchedPlayerQuery = query;
  matchedPlayers = players;
  playerMatchSelect.replaceChildren();
  for (const player of players) {
    const option = document.createElement("option");
    option.value = player.id;
    const rank = player.stats?.rank ? `#${player.stats.rank}` : "Unranked";
    option.textContent = `${player.name} · ${player.country || "--"} · ${rank} · ${player.id}`;
    playerMatchSelect.append(option);
  }
  playerMatch.hidden = false;
}

async function fetchScorePage(playerId, page) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    sort: "accuracy",
    personalBest: "true",
  });
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  let response;
  try {
    response = await fetch(
      `${API_ROOT}/players/${encodeURIComponent(playerId)}/scores?${query}`,
      { signal: controller.signal },
    );
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "ScoreSaber did not respond within 15 seconds. Check your connection and try again.",
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach ScoreSaber. Check your internet connection and retry. If you opened this file directly, run it through a local web server.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  if (response.status === 404)
    throw new Error("That player profile was not found.");
  if (response.status === 429)
    throw new Error(
      "ScoreSaber is rate limiting requests. Wait a moment, then try again.",
    );
  if (!response.ok)
    throw new Error(`ScoreSaber returned an error (${response.status}).`);
  const body = await response.json();
  if (!Array.isArray(body.data))
    throw new Error(
      "ScoreSaber returned an unexpected response. Please retry shortly.",
    );
  return body;
}

function normalizeScore(entry) {
  const score = entry.score;
  const board = entry.leaderboard;
  const rawAccuracy = Number(score.accuracy);
  return {
    accuracy: rawAccuracy * 100,
    stars: Number(board.realm?.stars),
    map: board.map,
    leaderboard: board,
    score,
    difficulty: board.difficulty ?? {},
  };
}

function extractPlayerId(value) {
  const text = value.trim();
  if (/^\d{5,25}$/.test(text)) return text;
  const match =
    text.match(/(?:^|\/)u\/(\d{5,25})(?:\/|$|[?#])/i) ??
    text.match(/(?:^|\D)(\d{5,25})(?:\D|$)/);
  return match?.[1] ?? "";
}

function renderTracks() {
  if (!allScores.length) {
    if (!trackList.contains(emptyState)) trackList.replaceChildren(emptyState);
    trackCount.textContent = "0 MAPS";
    downloadButton.disabled = true;
    return;
  }

  const selected = getSelectedMaps();
  trackList.replaceChildren(
    ...selected.map((score, index) => createTrackRow(score, index)),
  );
  trackCount.textContent = `${selected.length} MAP${selected.length === 1 ? "" : "S"}`;
  downloadButton.disabled = false;
  limitNote.hidden = true;
}

function createTrackRow(item, index) {
  const row = document.createElement("article");
  row.className = "track-row";
  row.style.animationDelay = `${Math.min(index, 12) * 24}ms`;

  const main = document.createElement("div");
  main.className = "track-main";
  const cover = document.createElement("div");
  cover.className = "cover";
  cover.textContent = (item.map.songName ?? "?").slice(0, 1).toUpperCase();
  if (item.map.coverUrl) {
    const image = document.createElement("img");
    image.src = item.map.coverUrl;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    cover.replaceChildren(image);
  }
  const copy = document.createElement("div");
  copy.className = "track-copy";
  const name = document.createElement("div");
  name.className = "track-name";
  name.textContent = item.map.songName || "Unknown track";
  const author = document.createElement("div");
  author.className = "track-author";
  author.textContent =
    item.map.songAuthorName || item.map.levelAuthorName || "Unknown artist";
  copy.append(name, author);
  main.append(cover, copy);

  const difficultyCell = document.createElement("div");
  difficultyCell.className = "difficulty-cell";
  const difficulty = document.createElement("span");
  difficulty.className = `difficulty-dot ${difficultyClass(item.difficulty.rawDifficulty)}`;
  const difficultyText = document.createElement("span");
  difficultyText.className = "difficulty-text";
  const playlistDifficulty = formatPlaylistDifficulty(item.difficulty);
  difficultyText.textContent = `${playlistDifficulty.characteristic} / ${playlistDifficulty.name}`;
  difficultyCell.append(difficulty, difficultyText);

  const accuracy = document.createElement("div");
  accuracy.className = "accuracy-cell";
  accuracy.textContent = `${item.accuracy.toFixed(2)}%`;
  const accuracyLabel = document.createElement("small");
  accuracyLabel.textContent = `${item.stars.toFixed(1)} STARS`;
  accuracy.append(accuracyLabel);

  row.append(main, difficultyCell, accuracy);
  return row;
}

function difficultyClass(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (normalized.includes("expertplus")) return "expertplus";
  if (normalized.includes("expert")) return "expert";
  if (normalized.includes("hard")) return "hard";
  if (normalized.includes("normal")) return "normal";
  return "easy";
}

function formatPlaylistDifficulty(difficulty) {
  const rawName = String(difficulty.rawDifficulty || "Expert").replace(
    /^_/,
    "",
  );
  const gameMode = String(difficulty.gameMode || "SoloStandard");
  return {
    name: rawName.split("_")[0] || "Expert",
    characteristic: gameMode.replace(/^Solo/, "") || gameMode,
  };
}

function handleStarPointerDown(event) {
  const handle = event.target.closest("[data-star-handle]");
  if (handle) {
    activeStarHandle = handle;
  } else {
    const value = valueFromStarPointer(event);
    activeStarHandle =
      Math.abs(value - minimumStars) <= Math.abs(value - maximumStars)
        ? starMinHandle
        : starMaxHandle;
    setStarHandleValue(activeStarHandle, value);
  }
  activeStarPointerId = event.pointerId;
  starRangeControl.setPointerCapture(event.pointerId);
  activeStarHandle.focus();
  event.preventDefault();
}

function handleStarPointerMove(event) {
  if (!activeStarHandle || event.pointerId !== activeStarPointerId) return;
  setStarHandleValue(activeStarHandle, valueFromStarPointer(event));
}

function endStarPointerDrag(event) {
  if (event.pointerId !== activeStarPointerId) return;
  activeStarHandle = null;
  activeStarPointerId = null;
}

function valueFromStarPointer(event) {
  const bounds = starRangeControl.getBoundingClientRect();
  return clampStarValue(((event.clientX - bounds.left) / bounds.width) * 20);
}

function handleStarKeydown(event) {
  const handle = event.currentTarget;
  const isMinimum = handle === starMinHandle;
  const currentValue = isMinimum ? minimumStars : maximumStars;
  let nextValue;
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      nextValue = currentValue - 0.1;
      break;
    case "ArrowRight":
    case "ArrowUp":
      nextValue = currentValue + 0.1;
      break;
    case "PageDown":
      nextValue = currentValue - 1;
      break;
    case "PageUp":
      nextValue = currentValue + 1;
      break;
    case "Home":
      nextValue = 0;
      break;
    case "End":
      nextValue = 20;
      break;
    default:
      return;
  }
  event.preventDefault();
  setStarHandleValue(handle, nextValue);
}

function setStarHandleValue(handle, value) {
  const nextValue = clampStarValue(value);
  if (handle === starMinHandle) {
    minimumStars = Math.min(nextValue, maximumStars);
  } else {
    maximumStars = Math.max(nextValue, minimumStars);
  }
  updateStarRangeDisplay();
  if (loadedPlayerId) {
    window.clearTimeout(starRangeRefreshTimer);
    starRangeRefreshTimer = window.setTimeout(() => form.requestSubmit(), 350);
  }
}

function clampStarValue(value) {
  return Math.min(20, Math.max(0, Math.round(value * 10) / 10));
}

function updateStarRangeDisplay() {
  starRangeOutput.value = `${minimumStars.toFixed(1)} - ${maximumStars.toFixed(1)} STARS`;
  starRangeOutput.textContent = `${minimumStars.toFixed(1)} - ${maximumStars.toFixed(1)} STARS`;
  starRangeFill.style.left = `${(minimumStars / 20) * 100}%`;
  starRangeFill.style.width = `${((maximumStars - minimumStars) / 20) * 100}%`;
  updateStarHandle(starMinHandle, minimumStars, maximumStars, "minimum");
  updateStarHandle(starMaxHandle, maximumStars, minimumStars, "maximum");
}

function updateStarHandle(handle, value, bound, label) {
  handle.style.left = `${(value / 20) * 100}%`;
  handle.setAttribute("aria-valuemin", String(label === "minimum" ? 0 : bound));
  handle.setAttribute(
    "aria-valuemax",
    String(label === "minimum" ? bound : 20),
  );
  handle.setAttribute("aria-valuenow", value.toFixed(1));
  handle.setAttribute("aria-valuetext", `${value.toFixed(1)} stars ${label}`);
}

function getSelectedMaps() {
  return allScores
    .filter(
      (score) =>
        score.stars >= minimumStars &&
        score.stars <= maximumStars &&
        score.accuracy >= minimumAccuracy &&
        score.accuracy <= maximumAccuracy,
    )
    .slice(0, Number(sizeSlider.value));
}

function handleAccuracyPointerDown(event) {
  const handle = event.target.closest("[data-accuracy-handle]");
  if (handle) {
    activeAccuracyHandle = handle;
  } else {
    const value = valueFromAccuracyPointer(event);
    activeAccuracyHandle =
      Math.abs(value - minimumAccuracy) <= Math.abs(value - maximumAccuracy)
        ? accuracyMinHandle
        : accuracyMaxHandle;
    setAccuracyHandleValue(activeAccuracyHandle, value);
  }
  activeAccuracyPointerId = event.pointerId;
  try {
    accuracyRangeControl.setPointerCapture(event.pointerId);
  } catch {
    // The range still follows pointermove when capture is unavailable.
  }
  activeAccuracyHandle.focus();
  event.preventDefault();
}

function handleAccuracyPointerMove(event) {
  if (!activeAccuracyHandle || event.pointerId !== activeAccuracyPointerId)
    return;
  setAccuracyHandleValue(activeAccuracyHandle, valueFromAccuracyPointer(event));
}

function endAccuracyPointerDrag(event) {
  if (event.pointerId !== activeAccuracyPointerId) return;
  activeAccuracyHandle = null;
  activeAccuracyPointerId = null;
}

function valueFromAccuracyPointer(event) {
  const bounds = accuracyRangeControl.getBoundingClientRect();
  return clampAccuracyValue(
    ((event.clientX - bounds.left) / bounds.width) * 100,
  );
}

function handleAccuracyKeydown(event) {
  const handle = event.currentTarget;
  const isMinimum = handle === accuracyMinHandle;
  const currentValue = isMinimum ? minimumAccuracy : maximumAccuracy;
  let nextValue;
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      nextValue = currentValue - 1;
      break;
    case "ArrowRight":
    case "ArrowUp":
      nextValue = currentValue + 1;
      break;
    case "PageDown":
      nextValue = currentValue - 5;
      break;
    case "PageUp":
      nextValue = currentValue + 5;
      break;
    case "Home":
      nextValue = 0;
      break;
    case "End":
      nextValue = 100;
      break;
    default:
      return;
  }
  event.preventDefault();
  setAccuracyHandleValue(handle, nextValue);
}

function setAccuracyHandleValue(handle, value) {
  const nextValue = clampAccuracyValue(value);
  if (handle === accuracyMinHandle) {
    minimumAccuracy = Math.min(nextValue, maximumAccuracy);
  } else {
    maximumAccuracy = Math.max(nextValue, minimumAccuracy);
  }
  updateAccuracyRangeDisplay();
  if (loadedPlayerId) {
    window.clearTimeout(starRangeRefreshTimer);
    starRangeRefreshTimer = window.setTimeout(() => form.requestSubmit(), 350);
  }
}

function clampAccuracyValue(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function updateAccuracyRangeDisplay() {
  accuracyRangeOutput.value = `${minimumAccuracy}% - ${maximumAccuracy}%`;
  accuracyRangeOutput.textContent = accuracyRangeOutput.value;
  accuracyRangeFill.style.left = `${minimumAccuracy}%`;
  accuracyRangeFill.style.width = `${maximumAccuracy - minimumAccuracy}%`;
  updateAccuracyHandle(
    accuracyMinHandle,
    minimumAccuracy,
    maximumAccuracy,
    "minimum",
  );
  updateAccuracyHandle(
    accuracyMaxHandle,
    maximumAccuracy,
    minimumAccuracy,
    "maximum",
  );
}

function updateAccuracyHandle(handle, value, bound, label) {
  handle.style.left = `${value}%`;
  handle.setAttribute("aria-valuemin", String(label === "minimum" ? 0 : bound));
  handle.setAttribute(
    "aria-valuemax",
    String(label === "minimum" ? bound : 100),
  );
  handle.setAttribute("aria-valuenow", String(value));
  handle.setAttribute("aria-valuetext", `${value}% ${label}`);
}

function showPlayer(playerId, player) {
  playerCard.hidden = false;
  playerName.textContent =
    player?.name || player?.playerNameInGame || `Player ${playerId}`;
  playerSubtitle.textContent = player?.country
    ? `${player.country} / ScoreSaber`
    : "ScoreSaber profile";
  playerLink.href = `https://scoresaber.com/u/${encodeURIComponent(playerId)}`;
  const avatarUrl = player?.avatar;
  if (avatarUrl) {
    const image = document.createElement("img");
    image.src = avatarUrl;
    image.alt = "";
    image.addEventListener(
      "error",
      () => playerAvatar.replaceChildren(document.createTextNode("SS")),
      { once: true },
    );
    playerAvatar.replaceChildren(image);
  } else {
    playerAvatar.replaceChildren(
      document.createTextNode((playerName.textContent[0] || "S").toUpperCase()),
    );
  }
}

function downloadPlaylist() {
  const selected = getSelectedMaps();
  if (!selected.length) return;

  const songsByHash = new Map();
  for (const item of selected) {
    const hash = String(item.map.hash).toUpperCase();
    if (!songsByHash.has(hash)) {
      songsByHash.set(hash, {
        key: hash,
        hash,
        songName: item.map.songName || "Unknown track",
        levelAuthorName: item.map.levelAuthorName || "Unknown mapper",
        difficulties: [],
      });
    }
    const song = songsByHash.get(hash);
    const difficulty = formatPlaylistDifficulty(item.difficulty);
    if (
      !song.difficulties.some(
        (entry) =>
          entry.name === difficulty.name &&
          entry.characteristic === difficulty.characteristic,
      )
    ) {
      song.difficulties.push(difficulty);
    }
  }

  const playerLabel = currentPlayer?.name || `Player ${currentPlayerId}`;
  const playlist = {
    playlistTitle: `${playerLabel} - Lowest Accuracy`,
    playlistAuthor: "Lowlight - ScoreSaber Playlist Studio",
    playlistDescription: `${selected.length} lowest-accuracy ranked maps from ${minimumAccuracy}% to ${maximumAccuracy}% accuracy and ${minimumStars.toFixed(1)} to ${maximumStars.toFixed(1)} stars.`,
    songs: [...songsByHash.values()],
    coverImage: "",
    allowDuplicates: false,
  };
  const blob = new Blob([JSON.stringify(playlist, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(playerLabel)}-lowest-accuracy.bplist`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "scoresaber-player"
  );
}

function setLoading(isLoading) {
  buildButton.disabled = isLoading;
  buildButton.querySelector("span").textContent = isLoading
    ? "Fetching..."
    : "Fetch scores";
}

function setStatus(message) {
  statusLine.hidden = false;
  statusLine.classList.remove("is-error");
  statusText.textContent = message;
}

function showError(message) {
  statusLine.hidden = false;
  statusLine.classList.add("is-error");
  statusText.textContent = message;
}

function hideStatus() {
  statusLine.hidden = true;
  statusLine.classList.remove("is-error");
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
