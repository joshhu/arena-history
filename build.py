# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb>=1.1", "huggingface_hub>=0.25"]
# ///
"""Build the static site: sync the dataset from the Hub, then precompute every leaderboard.

Output (./site):
  index.html, app.js, style.css           copied from ./static
  meta.json                               arenas, publish dates and categories per config
  data/<config>/<date>/<category>.json    one leaderboard, rank spread and previous rank precomputed

Usage:  uv run build.py [--sync] [--interval MINUTES]
"""

import argparse
import json
import shutil
import sys
from bisect import bisect_left, bisect_right
from datetime import datetime
from fnmatch import fnmatch
from itertools import groupby
from pathlib import Path

import duckdb
from huggingface_hub import HfApi, snapshot_download

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
STATIC = ROOT / "static"
SITE = ROOT / "site"
REPO = "lmarena-ai/leaderboard-dataset"
PATTERN = "*/full-*"
REVISION_FILE = DATA / ".revision"

# Arena groups shown in the nav. Each group maps "adjustment" -> dataset config.
# The first adjustment listed is the default (arena.ai defaults to Style Control).
ARENAS = [
    {"id": "text", "label": "Text", "group": "Chat", "variants": [
        ("style_control", "text_style_control"), ("default", "text"), ("factuality", "text_factuality")]},
    {"id": "webdev", "label": "WebDev", "group": "Code", "variants": [("default", "webdev")]},
    {"id": "vision", "label": "Vision", "group": "Chat", "variants": [
        ("style_control", "vision_style_control"), ("default", "vision")]},
    {"id": "document", "label": "Document", "group": "Chat", "variants": [
        ("style_control", "document_style_control"), ("default", "document")]},
    {"id": "search", "label": "Search", "group": "Chat", "variants": [
        ("style_control", "search_style_control"), ("default", "search"), ("factuality", "search_factuality")]},
    {"id": "text_to_image", "label": "Text-to-Image", "group": "Image", "variants": [("default", "text_to_image")]},
    {"id": "image_edit", "label": "Image Edit", "group": "Image", "variants": [("default", "image_edit")]},
    {"id": "text_to_video", "label": "Text-to-Video", "group": "Video", "variants": [("default", "text_to_video")]},
    {"id": "image_to_video", "label": "Image-to-Video", "group": "Video", "variants": [("default", "image_to_video")]},
    {"id": "video_edit", "label": "Video Edit", "group": "Video", "variants": [("default", "video_edit")]},
    {"id": "agent", "label": "Agent", "group": "Agent", "variants": [
        ("default", "agent"), ("steerability", "agent_steerability"),
        ("task_outcome", "agent_task_outcome_explicit"), ("tool_hallucination", "agent_tool_hallucination"),
        ("praise_complaint", "agent_praise_complaint"), ("bash_recovery", "agent_bash_recovery_steps"),
        ("bash_reliability", "agent_bash_reliability_no_prereq")]},
]

# Row layout in every data/<config>/<date>/<category>.json file.
COLS = ["model", "org", "license", "score", "lo", "hi", "votes", "sessions", "rank",
        "rank_best", "rank_worst", "prev_rank"]


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def local_revision() -> str | None:
    return REVISION_FILE.read_text().strip() if REVISION_FILE.exists() else None


def sync() -> bool:
    """Download the dataset if the Hub has a newer revision. Returns True if files changed."""
    info = HfApi().dataset_info(REPO)
    if info.sha == local_revision():
        return False
    snapshot_download(REPO, repo_type="dataset", revision=info.sha, allow_patterns=PATTERN, local_dir=DATA)
    # Drop shards that no longer exist upstream (e.g. after a re-shard), or rows would double up.
    remote = {s.rfilename for s in info.siblings or [] if fnmatch(s.rfilename, PATTERN)}
    for p in DATA.glob(PATTERN):
        if p.relative_to(DATA).as_posix() not in remote:
            p.unlink()
    REVISION_FILE.write_text(info.sha)
    print(f"[{now()}] Synced {REPO}@{info.sha[:8]}", flush=True)
    return True


def read_config(con, d: Path) -> list[tuple]:
    glob = str(d / "full-*.parquet")
    cols = {r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{glob}')").fetchall()}
    if "rating" in cols:
        score, lo, hi, votes = "rating", "rating_lower", "rating_upper", "vote_count"
    else:
        score, lo, hi, votes = "score", "score_ci_lower", "score_ci_upper", "observation_count"
    sessions = "session_count" if "session_count" in cols else "NULL"
    return con.execute(f"""
        SELECT leaderboard_publish_date, category, model_name, organization, license,
               {score}::DOUBLE, {lo}::DOUBLE, {hi}::DOUBLE, {votes}::DOUBLE, {sessions}::DOUBLE, rank::INTEGER
        FROM read_parquet('{glob}')
        ORDER BY 1, 2, rank, {score} DESC""").fetchall()


def board_rows(rows: list[tuple], prev: dict[str, int] | None, digits: int) -> list[list]:
    """Rows for one leaderboard, with arena.ai-style rank spread and the previous snapshot's rank.

    Rank spread: best possible rank = 1 + models whose lower CI is above my upper CI;
    worst = models whose upper CI reaches my lower CI.
    """
    los = sorted(r[6] for r in rows if r[6] is not None)
    his = sorted(r[7] for r in rows if r[7] is not None)
    rnd = lambda x: None if x is None else round(x, digits)
    out = []
    for _, _, model, org, lic, score, lo, hi, votes, sessions, rank in rows:
        if lo is None or hi is None:
            best = worst = rank
        else:
            best = 1 + len(los) - bisect_right(los, hi)
            worst = len(his) - bisect_left(his, lo)
        out.append([model, org, lic, rnd(score), rnd(lo), rnd(hi),
                    None if votes is None else int(votes), None if sessions is None else int(sessions),
                    rank, best, worst, None if prev is None else prev.get(model)])
    return out


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def build(out: Path = SITE, interval: float = 60) -> None:
    con = duckdb.connect()
    tmp = out.with_name(out.name + ".tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.copytree(STATIC, tmp)

    configs, n_files = {}, 0
    for d in sorted(DATA.iterdir()) if DATA.exists() else []:
        if not d.is_dir() or not list(d.glob("full-*.parquet")):
            continue
        cfg = d.name
        digits = 5 if cfg.startswith("agent") else 2
        dates, cats_by_date = [], {}
        prev_ranks: dict[str, dict[str, int]] | None = None
        for date, date_rows in groupby(read_config(con, d), key=lambda r: r[0]):
            by_cat = {c: list(rs) for c, rs in groupby(date_rows, key=lambda r: r[1])}
            cats = sorted(by_cat, key=lambda c: (c != "overall", -len(by_cat[c]), c))
            for cat, rows in by_cat.items():
                prev = None if prev_ranks is None else prev_ranks.get(cat, {})
                write_json(tmp / "data" / cfg / date / f"{cat}.json", board_rows(rows, prev, digits))
                n_files += 1
            prev_ranks = {c: {r[2]: r[10] for r in rs} for c, rs in by_cat.items()}
            dates.append(date)
            cats_by_date[date] = cats
        configs[cfg] = {"dates": dates, "categories": cats_by_date}

    arenas = []
    for a in ARENAS:
        variants = [{"id": v, "config": c} for v, c in a["variants"] if c in configs]
        if variants:
            arenas.append({**{k: a[k] for k in ("id", "label", "group")}, "variants": variants})
    write_json(tmp / "meta.json", {
        "arenas": arenas, "configs": configs, "cols": COLS,
        "revision": local_revision(), "built_at": now(), "check_interval_minutes": interval,
    })

    old = out.with_name(out.name + ".old")
    shutil.rmtree(old, ignore_errors=True)
    if out.exists():
        out.rename(old)
    tmp.rename(out)
    shutil.rmtree(old, ignore_errors=True)
    print(f"[{now()}] Built {n_files:,} leaderboards from {len(configs)} configs into {out}", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sync", action="store_true", help="download the latest dataset revision first")
    ap.add_argument("--interval", type=float, default=60, help="update check interval shown in the UI (minutes)")
    args = ap.parse_args()
    if args.sync:
        sync()
    if not local_revision() and not any(DATA.glob(PATTERN)):
        sys.exit("No data in ./data — run with --sync.")
    build(interval=args.interval)
