#!/usr/bin/env bash
# Push Supabase migrations using DATABASE_URL from .env.local (no Supabase CLI login).
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Missing .env.local"
  exit 1
fi

# Load DATABASE_URL only (no NEXT_PUBLIC_ or keys)
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set in .env.local"
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "psql not found. Install PostgreSQL client or use Supabase Dashboard SQL editor."
  exit 1
fi

echo "Pushing migrations (org_type, organizations_read, events)..."
for f in supabase/migrations/20260315000000_org_type_and_modules.sql \
         supabase/migrations/20260315010000_organizations_read_active.sql \
         supabase/migrations/20260316000000_events_entity.sql; do
  if [ -f "$f" ]; then
    echo "  $f"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || { echo "Failed: $f"; exit 1; }
  fi
done
echo "Done."
