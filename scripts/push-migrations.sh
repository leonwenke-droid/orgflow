#!/bin/bash
# Push Supabase migrations to the remote database
# Prerequisites:
#   1. Run: supabase login
#   2. Run: supabase link --project-ref nypxmasuockdemjunzzz
#      (enter DB password when prompted)
# Usage: ./scripts/push-migrations.sh

set -e
cd "$(dirname "$0")/.."

if ! command -v supabase &>/dev/null; then
  echo "Supabase CLI not found. Install: npm install -g supabase"
  exit 1
fi

echo "Pushing migrations via Supabase CLI..."
supabase db push
echo "Done."
