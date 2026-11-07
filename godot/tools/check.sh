#!/usr/bin/env bash
# Quiet on success; fail on engine errors as well as process exit codes.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
G="${GODOT:-./.tools/godot}"
[[ -f project.godot ]] || { echo 'Missing project.godot (M0.3).' >&2; exit 1; }
[[ -f tests/run_all.gd ]] || { echo 'Missing tests/run_all.gd (M0.4).' >&2; exit 1; }

run_checked() {
  local output code=0
  output=$("$G" --headless --path . "$@" 2>&1) || code=$?
  if [[ "$code" != 0 ]] || grep -qE 'ERROR|WARNING|FAIL' <<< "$output"; then
    printf '%s\n' "$output" >&2
    return 1
  fi
  grep -E 'tests passed' <<< "$output" || true
}

run_checked --import
while IFS= read -r -d '' script; do
  run_checked --check-only --script "res://${script#./}"
done < <(find . -type d \( -name .godot -o -name .tools -o -name build -o -name addons \) -prune \
  -o -type f -name '*.gd' -print0)
run_checked --script res://tests/run_all.gd
