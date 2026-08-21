#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Starting Render Build..."
npx pnpm@9 install --no-frozen-lockfile
npx pnpm@9 --filter @workspace/betpulse build
npx pnpm@9 --filter @workspace/api-server build
echo "Render Build Completed Successfully!"
