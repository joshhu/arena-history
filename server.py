# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb>=1.1", "huggingface_hub>=0.25"]
# ///
"""Local preview of the static site, with automatic dataset updates.

Serves ./site (built by build.py). A background thread checks the Hugging Face repo every
REFRESH_MINUTES and rebuilds the site when a new revision is published.
Run:  uv run server.py   (then open http://localhost:8765)
"""

import os
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from build import SITE, build, now, sync

PORT = int(os.environ.get("PORT", "8765"))
REFRESH_MINUTES = float(os.environ.get("REFRESH_MINUTES", "30"))


def sync_loop() -> None:
    while True:
        try:
            if sync():
                build(interval=REFRESH_MINUTES)
        except Exception as e:  # network hiccups shouldn't kill the server; keep serving old data
            print(f"[{now()}] Update failed: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
        time.sleep(REFRESH_MINUTES * 60)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        # Always revalidate so a page refresh picks up rebuilt data.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    if not (SITE / "meta.json").exists():
        print("Building site for the first time…", flush=True)
        sync()
        build(interval=REFRESH_MINUTES)
    threading.Thread(target=sync_loop, daemon=True).start()
    print(f"Checking for dataset updates every {REFRESH_MINUTES:g} min.")
    print(f"Open http://localhost:{PORT}", flush=True)
    # Pass the path, not a handle: build() swaps the directory atomically by renaming.
    handler = partial(Handler, directory=str(SITE))
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
