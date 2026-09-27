#!/usr/bin/env bash
# Applies every migration to a fresh local database and runs the SQL tests.
# Needs Postgres 15+ with PostGIS and pgRouting on the path. Usage: npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-kfw_test}"
dropdb --if-exists "$DB" && createdb "$DB"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
"${PSQL[@]}" -f tests/local-bootstrap.sql
for f in migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
for f in tests/*.test.sql; do echo "▶ $f"; "${PSQL[@]}" -f "$f"; done
echo "✓ database tests passed"
