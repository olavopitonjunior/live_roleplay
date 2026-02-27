#!/bin/sh
set -u

echo "[ENTRYPOINT] Phase 1: Downloading model files..."
python main.py download-files
echo "[ENTRYPOINT] Phase 1 done (exit code: $?)"

echo "[ENTRYPOINT] Phase 2: Starting agent worker..."
exec python main.py start
