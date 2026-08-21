#!/usr/bin/env bash
set -o errexit

echo "Starting Render Build..."
export NODE_ENV=development
npx pnpm@9 install --prod=false --no-frozen-lockfile
npx pnpm@9 --filter @workspace/betpulse build
npx pnpm@9 --filter @workspace/api-server build
echo "Render Build Completed Successfully!"
