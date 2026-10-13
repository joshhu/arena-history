# arena-history

Browse [Arena](https://arena.ai) (formerly LMArena / Chatbot Arena) leaderboards **as they were on any past date**, in an arena.ai-style UI.

**Live site: <https://josh.hu/arena-history/>**

Data comes from the official [`lmarena-ai/leaderboard-dataset`](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) (CC-BY-4.0), which contains every published leaderboard snapshot — Text since 2023-05-08, plus WebDev, Vision, Search, Document, Text-to-Image, Image Edit, Video and Agent arenas.

## Features

- Every visit / refresh opens on **today's** leaderboard (the latest snapshot published so far)
- Pick any date → shows the latest leaderboard published on or before that day; step through snapshots with ‹ › (or ← → keys)
- All arenas and adjustments (Style Control / None / Factuality), all categories (Coding, Math, languages, industries…)
- Rank spread computed from confidence intervals, rank change vs the previous snapshot, NEW markers
- License filter, search, sortable columns, Models / Labs views
- Arena, adjustment and category live in the URL hash; the date deliberately does not, so a refresh always returns to today

## How it works

The site is fully static. `build.py` downloads the dataset and precomputes every leaderboard into `site/`:

```
site/
  index.html, app.js, style.css           copied from static/
  meta.json                               arenas, publish dates and categories per config
  data/<config>/<date>/<category>.json    one leaderboard (~12k files)
```

A GitHub Actions workflow (`.github/workflows/pages.yml`) runs hourly, compares the dataset's revision on the Hub with the one in the deployed `meta.json`, and rebuilds + deploys to GitHub Pages only when it changed. Pushes to `main` always deploy.

## Local use

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv run server.py     # http://localhost:8765 — builds on first run, then checks for updates every 30 min
./update.sh          # or: sync + rebuild manually
```

| Env var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8765` | HTTP port |
| `REFRESH_MINUTES` | `30` | How often the local server checks the Hub for a new dataset revision |

After editing anything in `static/`, run `uv run build.py` to copy it into `site/`.

## Layout

| Path | Purpose |
| --- | --- |
| `build.py` | Syncs the dataset from the Hub and builds the static site into `site/` |
| `server.py` | Local preview server for `site/` with background sync + rebuild |
| `static/` | Vanilla HTML/CSS/JS front end |
| `.github/workflows/pages.yml` | Hourly check + build + deploy to GitHub Pages |

## Notes

- `Votes` in the header is the sum of per-model vote counts ÷ 2 (each battle counts toward two models), so it is an estimate. Agent arenas report observations instead.
- Price / context-window columns from arena.ai are not part of the dataset and are not shown.
- Not affiliated with Arena / LMArena. Leaderboard data © LMArena, CC-BY-4.0.
