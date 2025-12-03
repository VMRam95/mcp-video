#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title MCP Video
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🎬
# @raycast.packageName MCP Tools

# Documentation:
# @raycast.description Open MCP Video Web UI for video analysis
# @raycast.author Victor

PROJECT_DIR="/Users/victor.manuel.ramirez.marcos/Documentos/repositories/mcp-video"
PORT=4000
LOG_DIR="$PROJECT_DIR/logs"

# Create logs directory if doesn't exist
mkdir -p "$LOG_DIR"

# Check if web server is running
if ! lsof -i :$PORT > /dev/null 2>&1; then
    echo "Starting MCP Video web server..."
    cd "$PROJECT_DIR"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        npm install
    fi

    # Start web server in background
    nohup npm run web > "$LOG_DIR/web-server.log" 2>&1 &

    # Wait for server to start
    sleep 2
fi

# Open browser
open "http://localhost:$PORT"

echo "MCP Video opened at http://localhost:$PORT"
