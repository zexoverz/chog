#!/usr/bin/env bash
set -e

# Bun path
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Config
APP_DIR="/root/chog"
APP_NAME="lilstar-api-testnet"
REPO_URL="git@github.com:zexoverz/chog.git"
BRANCH="master"

echo "🚀 Starting deployment..."
echo "📅 $(date)"

# Create directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    echo "📁 Creating app directory..."
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    git clone "$REPO_URL" .
else
    cd "$APP_DIR"
fi

echo "📦 Fetching latest code..."
git fetch origin
git reset --hard origin/$BRANCH

echo "📦 Installing dependencies..."
bun install --filter backend

# Create logs directory if needed
mkdir -p packages/backend/logs

echo "🔁 Reloading PM2..."
cd /root/chog/packages/backend
pm2 reload "$APP_NAME" || pm2 start ecosystem.config.cjs --env production

pm2 save

echo "✅ Deployment finished successfully!"
echo "📅 $(date)"
