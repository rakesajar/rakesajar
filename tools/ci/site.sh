#!/usr/bin/env bash
# Gate adapter for the Pathfinder site. Usage: tools/ci/site.sh <tests|lint|sast|dependencies|diff_coverage|types|critical_tests>
# Requires dependencies installed with `npm ci --prefix site`. Never installs anything itself.
set -euo pipefail
cd "$(dirname "$0")/../../site"
test -d node_modules || { echo "node_modules missing: run npm ci --prefix site first" >&2; exit 2; }
case "${1:-}" in
  tests) npm run test && npm run build && npm run test:e2e ;;
  lint) npm run lint ;;
  sast) npx eslint --config eslint.sast.config.js --max-warnings 0 . ;;
  dependencies) npm audit --audit-level=high ;;
  types) npx tsc --noEmit -p . && npx astro check ;;
  # Invariants that protect users: personal-data validation, verification rules, refusals, sourced-passage checks.
  critical_tests) npx vitest run tests/unit/waitlist.test.ts tests/unit/store.test.ts tests/unit/sourced.test.ts tests/unit/concierge.test.ts tests/unit/eligibility.test.ts tests/unit/worker.test.ts ;;
  diff_coverage) npx vitest run --coverage --coverage.reportsDirectory="${AGENTIC_EVIDENCE_DIR:-/tmp}/coverage" ;;
  *) echo "unknown check: ${1:-}" >&2; exit 2 ;;
esac
