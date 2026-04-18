#!/usr/bin/env bash
set -euo pipefail

echo "Setting up le chien..."
echo ""

if [ ! -f web/.dev.vars ]; then
  cp web/.dev.vars.example web/.dev.vars
  echo "Created web/.dev.vars from example"
else
  echo "web/.dev.vars already exists, skipping"
fi

echo ""
echo "Installing dependencies..."
pnpm install

echo ""
echo "Running database migrations..."
cd web
pnpm run db:generate
pnpm run db:migrate:local

echo ""
echo "Done! Next steps:"
echo ""
echo "  1. Edit web/.dev.vars with your Polar, OpenAI, and Cloudflare keys"
echo "  2. Start the dev server:"
echo "     cd web && pnpm dev"
echo ""
echo "See README.md for full setup instructions."
