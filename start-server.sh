#!/bin/bash

# Scrabble Scorer PWA - Home Server Startup Script
# Usage: ./start-server.sh

echo "🎯 Starting Scrabble Scorer PWA on port 3037..."

# Change to server directory
cd "$(dirname "$0")/server"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js version 16 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
fi

# Set port and start the server
echo "🚀 Starting server on http://192.168.86.10:3037"
echo "📱 Access the PWA at: http://192.168.86.10:3037"
echo "🔗 API available at: http://192.168.86.10:3037/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

PORT=3037 npm start
