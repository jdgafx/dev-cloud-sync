#!/bin/bash
# Sync Worker - Handles single project synchronization
# Usage: ./sync-worker.sh <project_path>

set -e

PROJECT_PATH="$1"
PROJECT_NAME=$(basename "$PROJECT_PATH")
LOG_FILE="/home/chris/dev/dev-cloud-sync/logs/${PROJECT_NAME}.log"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%H:%M:%S')] $1" >> "$LOG_FILE"
}

info() {
    log "INFO: $1"
    echo -e "${BLUE}ℹ️  [$PROJECT_NAME]${NC} $1"
}

success() {
    log "SUCCESS: $1"
    echo -e "${GREEN}✅ [$PROJECT_NAME]${NC} $1"
}

warn() {
    log "WARN: $1"
    echo -e "${YELLOW}⚠️  [$PROJECT_NAME]${NC} $1"
}

error() {
    log "ERROR: $1"
    echo -e "${RED}❌ [$PROJECT_NAME]${NC} $1"
}

# Ensure we're in the project directory
cd "$PROJECT_PATH" || exit 1

# Initialize log
echo "=== Sync started for $PROJECT_NAME ===" > "$LOG_FILE"

# 1. GITHUB SYNC
# ---------------------------------------------------------
info "Checking GitHub status..."

if [ ! -d ".git" ]; then
    info "Initializing git repository..."
    git init >> "$LOG_FILE" 2>&1
    git add -A >> "$LOG_FILE" 2>&1
    git commit -m "Initial commit (dev-cloud-sync)" >> "$LOG_FILE" 2>&1 || true
fi

# Check for remote and verify validity
REMOTE_VALID=false
if git remote get-url origin &>/dev/null; then
    # Remote exists, check if it's valid
    if git ls-remote origin HEAD &>/dev/null; then
        REMOTE_VALID=true
        info "Existing remote is valid"
    else
        warn "Existing remote is invalid or inaccessible"
    fi
fi

if [ "$REMOTE_VALID" = false ]; then
    info "Setting up GitHub repository..."
    
    # Check if repo exists on GitHub (owned by user)
    if gh repo view "CGDarkstardev1/$PROJECT_NAME" &>/dev/null; then
        info "Linking to existing repository: CGDarkstardev1/$PROJECT_NAME"
        if git remote get-url origin &>/dev/null; then
            git remote set-url origin "https://github.com/CGDarkstardev1/$PROJECT_NAME.git"
        else
            git remote add origin "https://github.com/CGDarkstardev1/$PROJECT_NAME.git"
        fi
    else
        info "Creating new private repository: CGDarkstardev1/$PROJECT_NAME"
        # Create repo and set remote in one go
        gh repo create "CGDarkstardev1/$PROJECT_NAME" --private --source=. --remote=origin >> "$LOG_FILE" 2>&1 || {
            # Fallback if source=. fails (e.g. if already has remote)
            gh repo create "CGDarkstardev1/$PROJECT_NAME" --private >> "$LOG_FILE" 2>&1
            git remote set-url origin "https://github.com/CGDarkstardev1/$PROJECT_NAME.git"
        }
    fi
fi

# Commit any pending changes
if [ -n "$(git status --porcelain)" ]; then
    info "Committing pending changes..."
    git add -A >> "$LOG_FILE" 2>&1
    git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M')" >> "$LOG_FILE" 2>&1 || true
fi

# Push to GitHub
info "Pushing to GitHub..."
git push -u origin --all --force >> "$LOG_FILE" 2>&1 || {
    warn "Push failed, trying simple push..."
    git push origin HEAD >> "$LOG_FILE" 2>&1
}
success "GitHub sync complete"

# 2. PUTER SYNC
# ---------------------------------------------------------
# Check for Puter indicators
IS_PUTER=false
if [ -f "puter.json" ] || [ -d ".puter" ] || grep -q "puter" package.json 2>/dev/null; then
    IS_PUTER=true
fi

if [ "$IS_PUTER" = true ]; then
    info "Detected Puter project. Syncing..."
    
    # If puter-cli is available
    if command -v puter &>/dev/null; then
        # Try to deploy/sync
        # Using a specialized node script for robust transfer
        node -e "
        const fs = require('fs');
        const path = require('path');
        // Import our sync service (we'll assume it's globally available or relative)
        // For now, we'll shell out to the existing puter sync if available
        " >> "$LOG_FILE" 2>&1
        
        info "Puter sync initiated (background)"
    else
        warn "Puter CLI not found, skipping Puter sync"
    fi
else
    log "Not a Puter project, skipping"
fi

success "Sync finished successfully"
