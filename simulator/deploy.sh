#!/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
npm ci
VITE_BASE=/link-budget/ npm run build
sudo rsync -a --delete dist/ /var/www/link-budget/dist/
sudo restorecon -R /var/www/link-budget/dist
