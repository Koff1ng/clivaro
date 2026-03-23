#!/usr/bin/env bash
# Despliegue: BD (Prisma) + git push + Vercel
# Uso: ./scripts/deploy-production.sh [--no-db] [--no-git] [--no-vercel] [--branch main]
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/deploy-production.mjs "$@"
