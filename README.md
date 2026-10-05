# ScoreSaber Playlist Tools

Two browser-based Beat Saber playlist utilities powered by ScoreSaber API v2:

- **Lowest Accuracy Playlist** builds a playlist from a player's ranked personal bests within selected star and existing-accuracy ranges.
- **Ranked Maps Playlist** exports every ranked difficulty in a selected star range.

## GitHub Pages

- Push this repository to GitHub.
- Open **Settings → Pages**.
- Under **Build and deployment**, select **Deploy from a branch**.
- Select the branch and `/ (root)` folder, then save.

GitHub Pages cannot proxy API requests, and ScoreSaber does not return browser CORS headers. Deploy `scoresaber-proxy.js` as a Cloudflare Worker. Cloudflare's dashboard labels change occasionally; the current official flow is documented in the [Workers dashboard guide](https://developers.cloudflare.com/workers/get-started/dashboard/):

- Open **Workers & Pages** and select **Create application**.
- Choose a Worker template to create the Worker, then deploy it.
- Open the deployed Worker and use its code editor to replace the starter code with `scoresaber-proxy.js`; save and deploy the update.
- Copy the Worker `workers.dev` URL.
- Set `window.SCORESABER_API_ROOT` in `config.js` to the Worker URL. You may include `/api/v2` or use the Worker root:

```js
window.SCORESABER_API_ROOT =
  "https://your-worker.your-account.workers.dev/api/v2";
```

The Worker root URL returns a health response. To test API forwarding, request a supported route such as `/api/v2/maps?page=1&limit=1&status=RANKED&minStars=0&maxStars=10`. Commit the config change and publish the site. Local preview may leave `config.js` empty and call ScoreSaber directly.

## Local Preview

Open `index.html`, or run `python -m http.server 8000` and visit `http://localhost:8000`.
