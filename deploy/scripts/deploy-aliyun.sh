#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/skuauditpro"
RELEASE_DIR="$APP_DIR/current"

sudo mkdir -p "$RELEASE_DIR" /var/www/certbot
sudo rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "data/*.db" \
  --exclude "data/*.db-*" \
  ./ "$RELEASE_DIR"/

cd "$RELEASE_DIR"
node --version
npm run check
npm test
npm run db:migrate

sudo cp deploy/nginx/skuauditpro.com.conf /etc/nginx/sites-available/skuauditpro.com.conf
sudo ln -sf /etc/nginx/sites-available/skuauditpro.com.conf /etc/nginx/sites-enabled/skuauditpro.com.conf
sudo nginx -t
sudo systemctl reload nginx

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
