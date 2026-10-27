# ScoreSaber Playlist Tools

Two browser-based Beat Saber playlist utilities powered by ScoreSaber API v2, written in TypeScript:

- **Lowest Accuracy Playlist** builds a playlist from a player's ranked personal bests within selected star and existing-accuracy ranges.
- **Ranked Maps Playlist** exports every ranked difficulty in a selected star range.

## Project layout

```
public/              static files copied as-is to dist/ (index.html, styles.css, config.js)
src/                 TypeScript source, bundled to dist/app.js
  main.ts            entry point + hash navigation
  accuracy.ts        Lowest Accuracy tool
  ranked.ts          Ranked Maps tool
  api.ts             ScoreSaber requests, timeouts, error messages
  slider.ts          reusable two-handle range slider
  playlist.ts        .bplist building + download
  ui.ts, dom.ts      shared DOM helpers
  types.ts           ScoreSaber response types
scoresaber-proxy.js  Cloudflare Worker (CORS proxy) - deployed separately
```

## Development

```sh
npm install
npm run dev         # watch + serve at http://localhost:8000
npm run typecheck   # tsc --noEmit
npm run build       # production bundle in dist/
```

`public/config.js` may leave `SCORESABER_API_ROOT` empty for local use to call ScoreSaber directly (if CORS allows) or point it at your Worker.

## GitHub Pages

The site is built and deployed by `.github/workflows/deploy.yml` on every push to `main`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## CORS proxy (Cloudflare Worker)

GitHub Pages cannot proxy API requests, and ScoreSaber does not return browser CORS headers. Deploy `scoresaber-proxy.js` as a Cloudflare Worker, following the [Workers dashboard guide](https://developers.cloudflare.com/workers/get-started/dashboard/):

- Open **Workers & Pages** and select **Create application**.
- Create a Worker, then replace the starter code with `scoresaber-proxy.js`; save and deploy.
- Copy the Worker `workers.dev` URL.
- Set it in `public/config.js` (with or without `/api/v2`):

```js
window.SCORESABER_API_ROOT =
  "https://your-worker.your-account.workers.dev/api/v2";
```

The Worker root URL returns a health response. To test forwarding, request e.g. `/api/v2/maps?page=1&limit=1&status=RANKED&minStars=0&maxStars=10`.
