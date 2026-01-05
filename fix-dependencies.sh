#!/bin/bash

# Fix native dependencies for better-sqlite3
echo "🔧 Fixing native dependencies for your server..."

cd "$(dirname "$0")/server"

echo "📦 Removing existing node_modules..."
rm -rf node_modules package-lock.json

echo "🔄 Reinstalling dependencies with rebuild..."
npm install

echo "🛠️ Rebuilding native modules..."
npm rebuild

echo "✅ Dependencies fixed! Try starting the server again."
echo ""
echo "Run: ./start-server.sh"
