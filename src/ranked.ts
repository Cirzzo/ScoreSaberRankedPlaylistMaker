import { $, errorMessage, pause, setButtonLabel } from "./dom";
import { fetchRankedMapPage, PAGE_PAUSE_MS } from "./api";
import { buildSongs, downloadPlaylist, type Playlist } from "./playlist";
import { RangeSlider, STAR_SLIDER } from "./slider";
import { StatusLine, createTrackRow } from "./ui";
import type { Leaderboard, RankedMap } from "./types";

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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void fetchAll();
  });
  downloadButton.addEventListener("click", download);

  async function fetchAll(): Promise<void> {
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
      resultsSubtitle.textContent = `${entries.length.toLocaleString()} difficulties across ${uniqueMapCount().toLocaleString()} matching maps (${allMaps.length.toLocaleString()} maps scanned).`;
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
    const low = stars.low.toFixed(1);
    const high = stars.high.toFixed(1);
    const mapCount = uniqueMapCount();
    const playlist: Playlist = {
      playlistTitle: `Ranked Maps ${low}-${high} Stars`,
      playlistAuthor: "ScoreSaber Playlist Tools",
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
