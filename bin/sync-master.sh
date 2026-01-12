#!/bin/bash
# Sync Master - Orchestrates parallel synchronization of all dev projects
# Usage: ./sync-master.sh

set -e

# Configuration
DEV_ROOT="/home/chris/dev"
MAX_JOBS=8  # Parallel workers
WORKER_SCRIPT="/home/chris/dev/dev-cloud-sync/bin/sync-worker.sh"
LOG_DIR="/home/chris/dev/dev-cloud-sync/logs"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'
BOLD='\033[1m'

# Header
echo -e "${PURPLE}╔════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${PURPLE}║${RESET}  ${BOLD}🚀 Dev Cloud Sync - Massive Parallel Uploader${RESET}             ${PURPLE}║${RESET}"
echo -e "${PURPLE}╚════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# 1. Discovery Phase
echo -e "${CYAN}🔍 Scanning $DEV_ROOT for projects...${RESET}"
PROJECTS=$(find "$DEV_ROOT" -maxdepth 2 -type d -name ".git" | sed 's/\/.git//' | sort)
COUNT=$(echo "$PROJECTS" | wc -l)

echo -e "${GREEN}✓ Found $COUNT projects${RESET}"
echo ""

# 2. Execution Phase
echo -e "${CYAN}🚀 Starting synchronization ($MAX_JOBS parallel workers)...${RESET}"
echo ""

# Create a temporary file to track jobs
JOB_LIST=$(mktemp)
echo "$PROJECTS" > "$JOB_LIST"

# Parallel Execution using xargs
# -P: max procs
# -I: replace string
# -n: max args
cat "$JOB_LIST" | xargs -P "$MAX_JOBS" -n 1 -I {} bash -c "
    PROJECT_NAME=\$(basename \"{}\")
    $WORKER_SCRIPT \"{}\"
"

# Cleanup
rm "$JOB_LIST"

echo ""
echo -e "${GREEN}✨ All projects synchronized!${RESET}"
echo -e "📝 Logs available in: $LOG_DIR"
