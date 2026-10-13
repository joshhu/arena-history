# arena-history

Browse [Arena](https://arena.ai) (formerly LMArena / Chatbot Arena) leaderboards **as they were on any past date**, locally, in an arena.ai-style UI.

Data comes from the official [`lmarena-ai/leaderboard-dataset`](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) (CC-BY-4.0), which contains every published leaderboard snapshot — Text since 2023-05-08, plus WebDev, Vision, Search, Document, Text-to-Image, Image Edit, Video and Agent arenas.

## Features

- Pick any date → shows the latest leaderboard published on or before that day; step through snapshots with ‹ › (or ← → keys)
- All arenas and adjustments (Style Control / None / Factuality), all categories (Coding, Math, languages, industries…)
- Rank spread computed from confidence intervals, rank change vs the previous snapshot, NEW markers
- License filter, search, sortable columns, Models / Labs views
- State lives in the URL hash, so any view is bookmarkable

## Requirements

- [uv](https://docs.astral.sh/uv/)
- [`hf` CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) (for downloading the dataset, ~120 MB)

## Usage

```bash
./update.sh          # download / refresh data into ./data
uv run server.py     # http://localhost:8765  (PORT env var to change)
```

Example: `http://localhost:8765/#arena=text&adj=style_control&date=2025-01-01&cat=coding`

## Layout

| Path | Purpose |
| --- | --- |
| `server.py` | Loads all parquet files into in-memory DuckDB; serves `/api/meta`, `/api/board` and the static UI |
| `static/` | Vanilla HTML/CSS/JS front end |
| `update.sh` | Downloads the dataset with `hf download` |

## Notes

- `Votes` in the header is the sum of per-model vote counts ÷ 2 (each battle counts toward two models). Agent arenas report observations instead.
- Price / context-window columns from arena.ai are not part of the dataset and are not shown.
- Not affiliated with Arena / LMArena.
