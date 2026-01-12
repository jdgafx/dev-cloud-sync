#!/bin/bash
#===============================================================================
# CloudSync Universal Installer
# Works on: Debian, Ubuntu, Fedora, RHEL, CentOS, Arch, Alpine, openSUSE
# Author: CGDarkstardev1
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Logging
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $1${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}\n"; }

# Detect Package Manager and Distro Family
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO="$ID"
        DISTRO_LIKE="$ID_LIKE"
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
    elif [ -f /etc/redhat-release ]; then
        DISTRO="rhel"
    elif [ -f /etc/arch-release ]; then
        DISTRO="arch"
    elif [ -f /etc/alpine-release ]; then
        DISTRO="alpine"
    else
        DISTRO="unknown"
    fi

    # Determine package manager
    if command -v apt-get &>/dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="sudo apt-get install -y"
        PKG_UPDATE="sudo apt-get update"
    elif command -v dnf &>/dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="sudo dnf install -y"
        PKG_UPDATE="sudo dnf check-update || true"
    elif command -v yum &>/dev/null; then
        PKG_MANAGER="yum"
        PKG_INSTALL="sudo yum install -y"
        PKG_UPDATE="sudo yum check-update || true"
    elif command -v pacman &>/dev/null; then
        PKG_MANAGER="pacman"
        PKG_INSTALL="sudo pacman -S --noconfirm"
        PKG_UPDATE="sudo pacman -Sy"
    elif command -v apk &>/dev/null; then
        PKG_MANAGER="apk"
        PKG_INSTALL="sudo apk add"
        PKG_UPDATE="sudo apk update"
    elif command -v zypper &>/dev/null; then
        PKG_MANAGER="zypper"
        PKG_INSTALL="sudo zypper install -y"
        PKG_UPDATE="sudo zypper refresh"
    else
        log_error "No supported package manager found!"
        exit 1
    fi

    log_info "Detected: ${BOLD}$DISTRO${NC} using ${BOLD}$PKG_MANAGER${NC}"
}

# Install Node.js 20+
install_nodejs() {
    if command -v node &>/dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            log_success "Node.js v$(node -v) already installed"
            return 0
        fi
    fi

    log_info "Installing Node.js 20+"

    case $PKG_MANAGER in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            $PKG_INSTALL nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            $PKG_INSTALL nodejs
            ;;
        pacman)
            $PKG_INSTALL nodejs npm
            ;;
        apk)
            $PKG_INSTALL nodejs npm
            ;;
        zypper)
            $PKG_INSTALL nodejs20 npm20
            ;;
    esac

    log_success "Node.js $(node -v) installed"
}

# Install rclone
install_rclone() {
    if command -v rclone &>/dev/null; then
        log_success "rclone $(rclone version | head -1 | awk '{print $2}') already installed"
        return 0
    fi

    log_info "Installing rclone..."
    curl https://rclone.org/install.sh | sudo bash
    log_success "rclone installed"
}

# Install system dependencies
install_dependencies() {
    log_step "Installing System Dependencies"
    
    $PKG_UPDATE

    case $PKG_MANAGER in
        apt)
            $PKG_INSTALL curl git jq build-essential
            ;;
        dnf|yum)
            $PKG_INSTALL curl git jq gcc-c++ make
            ;;
        pacman)
            $PKG_INSTALL curl git jq base-devel
            ;;
        apk)
            $PKG_INSTALL curl git jq build-base
            ;;
        zypper)
            $PKG_INSTALL curl git jq gcc-c++ make
            ;;
    esac

    install_nodejs
    install_rclone
}

# Build project
build_project() {
    log_step "Building CloudSync"

    cd "$(dirname "$0")/.."
    PROJECT_DIR=$(pwd)

    log_info "Installing npm dependencies..."
    npm install

    log_info "Building frontend..."
    npm run build -w apps/web

    log_info "Building backend..."
    npm run build -w packages/api-server || true

    log_success "Build complete"
}

# Configure systemd service
configure_service() {
    log_step "Configuring Systemd Service"

    cd "$(dirname "$0")/.."
    PROJECT_DIR=$(pwd)

    SERVICE_FILE="$PROJECT_DIR/scripts/dev-cloud-sync.service"
    
    if [ ! -f "$SERVICE_FILE" ]; then
        log_warn "Service file not found, creating..."
        mkdir -p "$PROJECT_DIR/scripts"
        cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Dev Cloud Sync Service
After=network.target

[Service]
Type=notify
User=$USER
WorkingDirectory=$PROJECT_DIR/packages/api-server
ExecStart=/bin/bash -c "npm run dev:start"
Restart=on-failure
RestartSec=10
NotifyAccess=all
WatchdogSec=60

[Install]
WantedBy=multi-user.target
EOF
    else
        # Update paths in existing service file
        sed -i "s|User=.*|User=$USER|" "$SERVICE_FILE"
        sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PROJECT_DIR/packages/api-server|" "$SERVICE_FILE"
    fi

    sudo cp "$SERVICE_FILE" /etc/systemd/system/dev-cloud-sync.service
    sudo systemctl daemon-reload
    sudo systemctl enable dev-cloud-sync
    sudo systemctl restart dev-cloud-sync

    log_success "Service configured and started"
}

# Install global CLI
install_cli() {
    log_step "Installing Global CLI"

    cd "$(dirname "$0")/.."
    PROJECT_DIR=$(pwd)

    CLI_FILE="$PROJECT_DIR/tools/cloudsync"
    
    if [ -f "$CLI_FILE" ]; then
        sudo ln -sf "$CLI_FILE" /usr/local/bin/cloudsync
        sudo chmod +x /usr/local/bin/cloudsync
        log_success "'cloudsync' command installed globally"
    else
        log_warn "CLI file not found at $CLI_FILE"
    fi
}

# Verify installation
verify_installation() {
    log_step "Verifying Installation"

    sleep 3

    if curl -s http://localhost:8888/health | grep -q '"status":"ok"'; then
        log_success "API server is running"
    else
        log_warn "API server may still be starting..."
    fi

    echo ""
    log_success "${BOLD}CloudSync installation complete!${NC}"
    echo ""
    echo -e "  ${CYAN}Web UI:${NC}     http://localhost:8888"
    echo -e "  ${CYAN}CLI:${NC}        cloudsync --help"
    echo -e "  ${CYAN}Logs:${NC}       cloudsync logs"
    echo -e "  ${CYAN}Status:${NC}     cloudsync status"
    echo ""
    echo -e "  ${YELLOW}Made by CGDarkstardev1${NC}"
    echo ""
}

# Configure rclone if needed
configure_rclone() {
    if [ ! -f ~/.config/rclone/rclone.conf ] || [ ! -s ~/.config/rclone/rclone.conf ]; then
        log_warn "No rclone remotes configured yet."
        echo ""
        echo -e "  ${CYAN}To configure a cloud remote, run:${NC}"
        echo -e "    rclone config"
        echo ""
    else
        REMOTE_COUNT=$(rclone listremotes | wc -l)
        log_success "$REMOTE_COUNT rclone remote(s) already configured"
    fi
}

# Main
main() {
    echo ""
    echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║                   CloudSync Universal Setup                   ║${NC}"
    echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    detect_distro
    install_dependencies
    build_project
    configure_service
    install_cli
    configure_rclone
    verify_installation
}

main "$@"
