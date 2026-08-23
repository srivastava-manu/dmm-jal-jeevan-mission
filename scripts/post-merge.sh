#!/usr/bin/env bash
set -euo pipefail

# Keep a merged workspace runnable without changing the lockfile or reseeding accounts.
npm ci --include=dev
npm run db:migrate
npm run build