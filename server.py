# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb>=1.1"]
# ///
"""Local server for browsing historical Arena (arena.ai) leaderboards.

Data: lmarena-ai/leaderboard-dataset (CC-BY-4.0), downloaded into ./data by update.sh.
Run:  uv run server.py   (then open http://localhost:8765)
"""

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import duckdb

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
STATIC = ROOT / "static"
PORT = int(os.environ.get("PORT", "8765"))

# Arena groups shown in the left nav. Each group maps "adjustment" -> dataset config.
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


def load(con: duckdb.DuckDBPyConnection) -> list[str]:
    """Load every downloaded config into one normalized table `lb`."""
    parts, configs = [], []
    for d in sorted(DATA.iterdir()):
        files = list(d.glob("full-*.parquet")) if d.is_dir() else []
        if not files:
            continue
        cfg = d.name
        glob = str(d / "full-*.parquet")
        cols = {r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{glob}')").fetchall()}
        if "rating" in cols:
            score, lo, hi, votes = "rating", "rating_lower", "rating_upper", "vote_count"
        else:
            score, lo, hi, votes = "score", "score_ci_lower", "score_ci_upper", "observation_count"
        sessions = "session_count" if "session_count" in cols else "NULL"
        parts.append(f"""
            SELECT '{cfg}' AS config, leaderboard_publish_date AS date, category,
                   model_name AS model, organization AS org, license,
                   {score}::DOUBLE AS score, {lo}::DOUBLE AS lo, {hi}::DOUBLE AS hi,
                   {votes}::DOUBLE AS votes, {sessions}::DOUBLE AS sessions, rank::INTEGER AS rank
            FROM read_parquet('{glob}')""")
        configs.append(cfg)
    if not parts:
        sys.exit("No data found in ./data — run ./update.sh first.")
    con.execute("CREATE TABLE lb AS " + " UNION ALL ".join(parts) + " ORDER BY config, date, category")
    return configs


con = duckdb.connect()
CONFIGS = load(con)


def q(sql: str, *params):
    cur = con.cursor()
    cur.execute(sql, list(params))
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def meta() -> dict:
    dates = {}
    for r in q("SELECT config, list(DISTINCT date ORDER BY date) AS dates FROM lb GROUP BY config"):
        dates[r["config"]] = r["dates"]
    arenas = []
    for a in ARENAS:
        variants = [{"id": v, "config": c, "dates": dates[c]} for v, c in a["variants"] if c in dates]
        if variants:
            arenas.append({**{k: a[k] for k in ("id", "label", "group")}, "variants": variants})
    return {"arenas": arenas}


def resolve_date(config: str, date: str) -> tuple[str | None, str | None, str | None]:
    """Latest publish date <= requested date, plus the previous/next publish dates."""
    ds = [r["date"] for r in q("SELECT DISTINCT date FROM lb WHERE config=? ORDER BY date", config)]
    if not ds:
        return None, None, None
    eligible = [d for d in ds if d <= date] if date else ds
    cur = eligible[-1] if eligible else ds[0]
    i = ds.index(cur)
    return cur, (ds[i - 1] if i > 0 else None), (ds[i + 1] if i + 1 < len(ds) else None)


def board(config: str, date: str, category: str) -> dict:
    if config not in CONFIGS:
        return {"error": f"unknown config {config}"}
    cur, prev, nxt = resolve_date(config, date)
    cats = [r["category"] for r in q(
        "SELECT category, count(*) n FROM lb WHERE config=? AND date=? GROUP BY category ORDER BY category <> 'overall', n DESC, category",
        config, cur)]
    if category not in cats:
        category = "overall" if "overall" in cats else cats[0]
    rows = q("""SELECT model, org, license, score, lo, hi, votes, sessions, rank
                FROM lb WHERE config=? AND date=? AND category=? ORDER BY rank, score DESC""",
             config, cur, category)
    # Rank spread, the same idea as arena.ai: best possible rank = 1 + models whose lower CI is
    # above my upper CI; worst = models whose upper CI reaches my lower CI.
    for r in rows:
        lo, hi = r["lo"], r["hi"]
        if lo is None or hi is None:
            r["rank_best"] = r["rank_worst"] = r["rank"]
            continue
        r["rank_best"] = 1 + sum(1 for o in rows if o["lo"] is not None and o["lo"] > hi)
        r["rank_worst"] = sum(1 for o in rows if o["hi"] is not None and o["hi"] >= lo)
    if prev:
        before = {r["model"]: r for r in q(
            "SELECT model, rank, score FROM lb WHERE config=? AND date=? AND category=?", config, prev, category)}
        for r in rows:
            p = before.get(r["model"])
            r["prev_rank"] = p["rank"] if p else None
            r["prev_score"] = p["score"] if p else None
    total_votes = sum(r["votes"] or 0 for r in rows)
    return {
        "config": config, "requested": date, "date": cur, "prev": prev, "next": nxt,
        "category": category, "categories": cats, "rows": rows,
        "models": len(rows), "total_votes": total_votes,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC), **kw)

    def log_message(self, fmt, *args):
        pass

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        p = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/api/meta":
            return self.send_json(meta())
        if u.path == "/api/board":
            res = board(p.get("config", "text_style_control"), p.get("date", ""), p.get("category", "overall"))
            return self.send_json(res, 400 if "error" in res else 200)
        return super().do_GET()


if __name__ == "__main__":
    n = con.execute("SELECT count(*) FROM lb").fetchone()[0]
    print(f"Loaded {n:,} rows from {len(CONFIGS)} configs.")
    print(f"Open http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
