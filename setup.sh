#!/bin/bash
set -e

# ==============================================================================
# Master Setup Script for Dev-Cloud-Sync
# ==============================================================================

# Colors/Formatting definitions (fallback if gum is missing)
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\133[0;33m'
RESET='\033[0m'

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------

log_info() {
  if command -v gum &> /dev/null; then
    gum style --foreground 212 "$1"
  else
    echo -e "${BLUE}[INFO]${RESET} $1"
  fi
}

log_success() {
  if command -v gum &> /dev/null; then
    gum style --foreground 46 --bold "$1"
  else
    echo -e "${GREEN}[SUCCESS]${RESET} $1"
  fi
}

log_error() {
  if command -v gum &> /dev/null; then
    gum style --foreground 196 --bold "$1"
  else
    echo -e "${RED}[ERROR]${RESET} $1"
  fi
}

ensure_gum() {
  if ! command -v gum &> /dev/null; then
    echo "This setup script relies on 'gum' for a beautiful CLI experience."
    read -p "Gum is not installed. Attempt to install it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v go &> /dev/null; then
             go install github.com/charmbracelet/gum@latest
        elif command -v brew &> /dev/null; then
             brew install gum
        elif command -v sudo &> /dev/null && command -v apt-get &> /dev/null; then
             sudo mkdir -p /etc/apt/keyrings
             curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
             echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
             sudo apt-get update && sudo apt-get install gum
        else
             echo "Could not auto-install gum. Proceeding with basic output."
             return
        fi
    fi
  fi
}

# ------------------------------------------------------------------------------
# Main Setup Flow
# ------------------------------------------------------------------------------

# Clear screen
clear

ensure_gum

# Header
if command -v gum &> /dev/null; then
    gum style \
	--border double \
	--margin "1 2" \
	--padding "2 4" \
	--border-foreground 212 \
	"Dev-Cloud-Sync" \
	"Autonomous Setup Assistant"
else
    echo "========================================"
    echo "   Dev-Cloud-Sync Setup Assistant"
    echo "========================================"
fi

# Step 1: Check Dependencies
log_info "Step 1: Checking System Dependencies..."

deps=("node" "npm" "docker" "docker-compose")
missing_deps=()

for dep in "${deps[@]}"; do
    if ! command -v $dep &> /dev/null; then
        missing_deps+=($dep)
    else
        echo -e "  ${GREEN}✓${RESET} $dep found"
    fi
done

if [ ${#missing_deps[@]} -ne 0 ]; then
    log_error "Missing dependencies: ${missing_deps[*]}"
    if command -v gum &> /dev/null; then
        gum confirm "Continue anyway? (May fail)" || exit 1
    else
       read -p "Continue anyway? (y/n) " -n 1 -r
       echo
       [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    fi
fi

# Step 2: Environment Configuration
log_info "Step 2: Configuring Environment..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        log_success "Created .env from .env.example"
        
        # Interactive editing?
        if command -v gum &> /dev/null; then
             if gum confirm "Do you want to review/edit the .env file now?"; then
                 gum write --placeholder "Edit .env content..." < .env > .env.tmp && mv .env.tmp .env
             fi
        fi
    else
        log_error "No .env.example found!"
    fi
else
    log_info ".env file already exists. Skipping creation."
fi

# Step 3: Install Project Dependencies
log_info "Step 3: Installing NPM Dependencies..."

if command -v gum &> /dev/null; then
    gum spin --spinner dot --title "Running npm install..." -- npm install
else
    npm install
fi
log_success "Dependencies installed."

# Step 3.5: Git Initialization
log_info "Step 3.5: Checking Git Repository..."
if [ ! -d .git ]; then
    if command -v gum &> /dev/null; then
        if gum confirm "Initialize Git repository?"; then
            git init
            log_success "Git repository initialized."
        fi
    else
         read -p "Initialize Git repository? (y/n) " -n 1 -r
         echo
         if [[ $REPLY =~ ^[Yy]$ ]]; then
             git init
             log_success "Git repository initialized."
         fi
    fi
else
    log_info "Git repository already initialized."
fi

# Step 3.6: Install Rclone (Powering the Sync Engine)
log_info "Step 3.6: Checking Rclone..."
if ! command -v rclone &> /dev/null; then
    log_info "Rclone not found. Installing..."
    if command -v gum &> /dev/null; then
        if gum confirm "Install Rclone (requires sudo)?"; then
             curl https://rclone.org/install.sh | sudo bash
             log_success "Rclone installed successfully."
        else
             log_warn "Rclone installation skipped. Sync capabilities may be limited."
        fi
    else
        read -p "Install Rclone (requires sudo)? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
             curl https://rclone.org/install.sh | sudo bash
             log_success "Rclone installed successfully."
        fi
    fi
else
    log_success "Rclone is already installed."
fi

# Step 4: Infrastructure Setup (Docker)
log_info "Step 4: Starting Docker Infrastructure..."

if command -v gum &> /dev/null; then
    gum spin --spinner monkey --title "Spinning up containers..." -- docker-compose up -d
else
    docker-compose up -d
fi

# Check services
if docker-compose ps | grep -q "Up"; then
    log_success "Infrastructure is running."
else
    log_warn "Some containers might have failed to start. Check 'docker-compose ps'."
fi

# Step 5: Database Migration (if applicable)
# Checking if we have a migration script
if grep -q "db:migrate" package.json; then
    log_info "Step 5: Running Database Migrations..."
    if command -v gum &> /dev/null; then
        gum spin --spinner points --title "Migrating database..." -- npm run db:migrate --if-present
    else
        npm run db:migrate --if-present
    fi
fi


# Step 6: Build Project
log_info "Step 6: Building Project..."
if command -v gum &> /dev/null; then
    gum spin --spinner line --title "Compiling TypeScript..." -- npm run build
else
    npm run build
fi
log_success "Build complete."

# Step 7: Final Summary (Enhanced)
echo ""
if command -v gum &> /dev/null; then
    gum style \
        --border rounded \
        --margin "1 2" \
        --padding "1 2" \
        --border-foreground 46 \
        "Setup Complete!" \
        " " \
        "Use the following commands to start:" \
        "  Start Dev Server: npm run dev" \
        "  Start Web App:    npm run dev -w @dev-cloud-sync/web-app" \
        "  Start API:        npm run dev -w @dev-cloud-sync/api-server"
else
    echo "Setup Complete!"
    echo "Run 'npm run dev' to start."
fi

# Step 8: Auto-Launch Dashboard
log_info "Attempting to launch dashboard..."
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000" &> /dev/null &
elif command -v sensible-browser &> /dev/null; then
    sensible-browser "http://localhost:3000" &> /dev/null &
else
    log_warn "Could not auto-open browser. Please visit http://localhost:3000"
fi

echo ""
