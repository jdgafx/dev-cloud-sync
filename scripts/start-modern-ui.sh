#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Starting CloudSync Unified Dashboard..."

# Start the API Server (which now serves the Web UI)
cd "$PROJECT_ROOT/packages/api-server"
# Use 'npm run start' if built, or 'npm run dev:start'
npm run dev:start
