#!/usr/bin/env bash
# Gate adapter for the Pathfinder site. Usage: tools/ci/site.sh <tests|lint|sast|dependencies|diff_coverage>
# Requires dependencies installed with `npm ci --prefix site`. Never installs anything itself.
set -euo pipefail
cd "$(dirname "$0")/../../site"
test -d node_modules || { echo "node_modules missing: run npm ci --prefix site first" >&2; exit 2; }
case "${1:-}" in
  tests) npm run test && npm run build && npm run test:e2e ;;
  lint) npm run lint ;;
  sast) npx eslint --config eslint.sast.config.js --max-warnings 0 . ;;
  dependencies) npm audit --audit-level=high ;;
  diff_coverage) npx vitest run --coverage --coverage.reportsDirectory="${AGENTIC_EVIDENCE_DIR:-/tmp}/coverage" ;;
  *) echo "unknown check: ${1:-}" >&2; exit 2 ;;
esac
