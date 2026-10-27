import type { Paged, Player, RankedMap, ScoreEntry } from "./types";

const API_ROOT = (
  window.SCORESABER_API_ROOT || "https://scoresaber.com/api/v2"
).replace(/\/+$/, "");

export const PAGE_SIZE = 100;
export const PAGE_PAUSE_MS = 180;
const REQUEST_TIMEOUT_MS = 15000;

interface ErrorMessages {
  timeout: string;
  network: string;
  notFound?: string;
  rateLimit: string;
  status: (code: number) => string;
  unexpected: string;
}

async function getPaged<T>(
  path: string,
  params: Record<string, string>,
  messages: ErrorMessages,
): Promise<Paged<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await fetch(
      `${API_ROOT}${path}?${new URLSearchParams(params)}`,
      {
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(messages.timeout);
    }
    if (error instanceof TypeError) throw new Error(messages.network);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 404 && messages.notFound) {
    throw new Error(messages.notFound);
  }
  if (response.status === 429) throw new Error(messages.rateLimit);
  if (!response.ok) throw new Error(messages.status(response.status));

  const body = (await response.json()) as Partial<Paged<T>>;
  if (!Array.isArray(body.data)) throw new Error(messages.unexpected);
  return body as Paged<T>;
}

export function fetchScorePage(playerId: string, page: number) {
  return getPaged<ScoreEntry>(
    `/players/${encodeURIComponent(playerId)}/scores`,
    {
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: "accuracy",
      personalBest: "true",
    },
    {
      timeout:
        "ScoreSaber did not respond within 15 seconds. Check your connection and try again.",
      network:
        "Could not reach ScoreSaber. Check your internet connection and retry. If you opened this file directly, run it through a local web server.",
      notFound: "That player profile was not found.",
      rateLimit:
        "ScoreSaber is rate limiting requests. Wait a moment, then try again.",
      status: (code) => `ScoreSaber returned an error (${code}).`,
      unexpected:
        "ScoreSaber returned an unexpected response. Please retry shortly.",
    },
  );
}

export function fetchRankedMapPage(
  page: number,
  minimumStars: number,
  maximumStars: number,
) {
  return getPaged<RankedMap>(
    "/maps",
    {
      page: String(page),
      limit: String(PAGE_SIZE),
      status: "RANKED",
      minStars: String(minimumStars),
      maxStars: String(maximumStars),
      sortBy: "highestStars",
      sortDirection: "asc",
    },
    {
      timeout: "ScoreSaber did not respond within 15 seconds. Try again.",
      network:
        "Could not reach ScoreSaber. Check your internet connection and try again.",
      rateLimit: "ScoreSaber is rate limiting requests. Wait, then retry.",
      status: (code) => `ScoreSaber returned an error (${code}).`,
      unexpected: "ScoreSaber returned an unexpected ranked maps response.",
    },
  );
}

export async function fetchPlayersByName(name: string): Promise<Player[]> {
  const body = await getPaged<Player>(
    "/players",
    { page: "1", limit: "10", search: name },
    {
      timeout: "ScoreSaber player search timed out. Please try again.",
      network:
        "Could not reach ScoreSaber. Check your connection and try again.",
      rateLimit: "ScoreSaber is rate limiting requests. Wait, then retry.",
      status: (code) => `ScoreSaber player search failed (${code}).`,
      unexpected: "ScoreSaber returned an unexpected player search response.",
    },
  );
  return body.data;
}
