# ScoreSaber Playlist Tools

Two browser-based Beat Saber playlist utilities powered by ScoreSaber API v2:

- **Lowest Accuracy Playlist** builds a playlist from a player's ranked personal bests within selected star and existing-accuracy ranges.
- **Ranked Maps Playlist** exports every ranked difficulty in a selected star range.

## GitHub Pages

- Push this repository to GitHub.
- Open **Settings → Pages**.
- Under **Build and deployment**, select **Deploy from a branch**.
- Select the branch and `/ (root)` folder, then save.

This is a static site with no build step. The published page uses the public ScoreSaber API and requires an internet connection.

## Local Preview

Open `index.html`, or run `python -m http.server 8000` and visit `http://localhost:8000`.
