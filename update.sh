#!/usr/bin/env bash
# Download / refresh the full leaderboard history from Hugging Face into ./data
set -euo pipefail
cd "$(dirname "$0")"
hf download lmarena-ai/leaderboard-dataset --repo-type dataset --include "*/full-*" --local-dir data
du -sh data
