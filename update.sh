#!/usr/bin/env bash
# Download the latest dataset revision from Hugging Face and rebuild ./site
set -euo pipefail
cd "$(dirname "$0")"
uv run build.py --sync "$@"
