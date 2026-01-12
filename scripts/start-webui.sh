#!/bin/bash
set -e

# ==============================================================================
# Rclone Web UI Laucher
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBUI_DIR="$PROJECT_ROOT/apps/rclone-webui"
BUILD_DIR="$WEBUI_DIR/build"

# Default configuration
RCLONE_USER="${RCLONE_USER:-admin}"
RCLONE_PASS="${RCLONE_PASS:-password}"
RCLONE_ADDR="${RCLONE_ADDR:-localhost:5572}"

echo "🚀 Starting Rclone Web UI Setup..."

# Check if rclone is installed
if ! command -v rclone &> /dev/null; then
    echo "❌ Error: rclone is not installed. Please install it first."
    exit 1
fi

# initial check for npm install completion
if [ ! -d "$WEBUI_DIR/node_modules" ]; then
    echo "📦 Installing Web UI dependencies..."
    cd "$WEBUI_DIR"
    npm install --legacy-peer-deps
    cd "$PROJECT_ROOT"
fi

# Check if build exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "🔨 Building Web UI..."
    cd "$WEBUI_DIR"
    npm run build
    cd "$PROJECT_ROOT"
else
    echo "✅ Web UI already built."
fi

echo "🔌 Starting rclone RCD server..."
echo "📍 Access the UI at: http://$RCLONE_ADDR"
echo "🔑 Credentials: $RCLONE_USER / $RCLONE_PASS"

# Start rclone serving the files
# --rc-serve: Serves the files
# --rc-files: Path to the files to serve
# --rc-user/pass: Auth
# --rc-addr: Address to bind
# --rc-allow-origin: CORS
rclone rcd \
    --rc-web-gui \
    --rc-web-gui-no-open-browser \
    --rc-serve \
    --rc-files "$BUILD_DIR" \
    --rc-user "$RCLONE_USER" \
    --rc-pass "$RCLONE_PASS" \
    --rc-addr "$RCLONE_ADDR" \
    --rc-allow-origin "*" \
    -v
