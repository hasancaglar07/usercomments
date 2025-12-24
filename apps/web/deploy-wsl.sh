#!/bin/bash
set -e

# Ensure we use Linux npm/node, not Windows
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# WSL native directory
WSL_PROJECT_DIR=~/review-deploy
SOURCE_DIR="/mnt/c/Users/ihsan/Desktop/review/apps/web"

echo "=== Node/npm versions ==="
which node
which npm
node -v
npm -v

echo "=== Cleaning previous build ==="
rm -rf $WSL_PROJECT_DIR
mkdir -p $WSL_PROJECT_DIR

echo "=== Copying project to WSL native directory ==="
# Copy without node_modules and build artifacts
cp -r $SOURCE_DIR/app $WSL_PROJECT_DIR/
cp -r $SOURCE_DIR/components $WSL_PROJECT_DIR/
cp -r $SOURCE_DIR/data $WSL_PROJECT_DIR/
cp -r $SOURCE_DIR/public $WSL_PROJECT_DIR/
cp -r $SOURCE_DIR/scripts $WSL_PROJECT_DIR/
cp -r $SOURCE_DIR/src $WSL_PROJECT_DIR/
cp -r $SOURCE_DIR/styles $WSL_PROJECT_DIR/
cp $SOURCE_DIR/package.json $WSL_PROJECT_DIR/
cp $SOURCE_DIR/next.config.ts $WSL_PROJECT_DIR/
cp $SOURCE_DIR/tsconfig.json $WSL_PROJECT_DIR/
cp $SOURCE_DIR/middleware.ts $WSL_PROJECT_DIR/
cp $SOURCE_DIR/postcss.config.mjs $WSL_PROJECT_DIR/
cp $SOURCE_DIR/eslint.config.mjs $WSL_PROJECT_DIR/ 2>/dev/null || true
cp $SOURCE_DIR/wrangler.toml $WSL_PROJECT_DIR/ 2>/dev/null || true
cp $SOURCE_DIR/wrangler.json $WSL_PROJECT_DIR/ 2>/dev/null || true

cd $WSL_PROJECT_DIR

# Environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://gmpvaxfyawnqbdyyybbf.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcHZheGZ5YXducWJkeXl5YmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDIzNjQsImV4cCI6MjA4MTkxODM2NH0.0bAXNixUdtoo8r0vXU89f8NFhQQqWIQV4DjghFqp3hEc"
export NEXT_PUBLIC_API_BASE_URL="https://irecommend-api.usercomments.workers.dev"

echo "=== Installing dependencies ==="
npm install

echo "=== Building with @cloudflare/next-on-pages ==="
npx @cloudflare/next-on-pages

echo "=== Deploying to Cloudflare Pages ==="
npx wrangler pages deploy .vercel/output/static --project-name usercomments --commit-dirty=true

echo "=== Deploy complete! ==="
