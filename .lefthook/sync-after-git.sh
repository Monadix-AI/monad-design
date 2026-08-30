#!/bin/sh
set -e

prev_head=$1
new_head=$2

# New worktree (or any checkout where node_modules is missing):
# bootstrap dev dependencies so the worktree is ready to use.
if [ ! -d node_modules ]; then
  echo "📦 node_modules missing — running bun install..." >&2
  bun install
fi

if [ -z "$prev_head" ] || [ -z "$new_head" ]; then
  # If arguments are missing, we can't compare.
  exit 0
fi

if git diff --name-only "$prev_head" "$new_head" | grep --quiet 'bun.lock'; then
  echo "📦 bun.lock changed." >&2
  echo "Running bun install..." >&2
  bun install
fi
