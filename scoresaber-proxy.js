const ALLOWED_PATHS = [
  /^\/maps$/,
  /^\/players$/,
  /^\/players\/[A-Za-z0-9_-]+\/scores$/,
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
    const apiPath = pathname.startsWith("/api/v2/")
      ? pathname.slice("/api/v2".length)
      : pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    if (pathname === "/" || pathname === "/api/v2") {
      return jsonResponse(
        {
          ok: true,
          service: "ScoreSaber CORS proxy",
          routes: [
            "/api/v2/maps",
            "/api/v2/players",
            "/api/v2/players/{id}/scores",
          ],
        },
        200,
      );
    }

    if (!ALLOWED_PATHS.some((pattern) => pattern.test(apiPath))) {
      return jsonResponse(
        { error: "Endpoint not allowed", path: requestUrl.pathname },
        404,
      );
    }

    const upstreamUrl = new URL(
      `/api/v2${apiPath}${requestUrl.search}`,
      "https://scoresaber.com",
    );
    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        headers: { Accept: "application/json" },
        signal: request.signal,
      });
    } catch {
      return jsonResponse({ error: "ScoreSaber is unavailable" }, 502);
    }

    const headers = new Headers(upstream.headers);
    for (const [name, value] of Object.entries(CORS_HEADERS)) {
      headers.set(name, value);
    }
    headers.set("Cache-Control", "public, max-age=30");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
