#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
KEY_FILE="$ROOT_DIR/id_ed25519"
REMOTE_DIR="${REMOTE_DIR:-/home/base-ubuntu/gpt-shop}"
REPO_URL="${REPO_URL:-https://github.com/Asagiry/shop-gpt.git}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env is required next to deploy.sh" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

SSH_USER="${SSH_USER:-base-ubuntu}"
SSH_TARGET="${SSH_USER}@${SSH_IP}"

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$SSH_TARGET" "REMOTE_DIR='$REMOTE_DIR' REPO_URL='$REPO_URL' bash -s" <<'REMOTE'
set -euo pipefail

if [[ ! -d "$REMOTE_DIR/.git" ]]; then
  rm -rf "$REMOTE_DIR"
  git clone "$REPO_URL" "$REMOTE_DIR"
fi
REMOTE

scp -i "$KEY_FILE" -o StrictHostKeyChecking=no "$ENV_FILE" "$SSH_TARGET:$REMOTE_DIR/.env"

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$SSH_TARGET" "REMOTE_DIR='$REMOTE_DIR' REPO_URL='$REPO_URL' bash -s" <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
git fetch origin main
git reset --hard origin/main

set -a
source .env
set +a
export PORT=80
export PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://gpt-shop.voimaxgm.online}"

npm install
npm install --prefix server
npm install --prefix client
npm run migrate
npm run seed
npm run build

NODE_BIN="$(readlink -f "$(command -v node)")"
if ! getcap "$NODE_BIN" | grep -q cap_net_bind_service; then
  sudo setcap 'cap_net_bind_service=+ep' "$NODE_BIN"
fi

pm2 delete gpt-shop >/dev/null 2>&1 || true
pm2 start server/dist/index.js --name gpt-shop --update-env
pm2 save
pm2 status gpt-shop
REMOTE
