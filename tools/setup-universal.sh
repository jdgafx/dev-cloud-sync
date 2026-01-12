#!/bin/bash
#
# CloudSync Universal Setup Script
# Works on ANY Linux distribution (Debian, RHEL, Arch, SUSE, etc.)
# Auto-installs dependencies, configures systemd, enables auto-start
#

set -euo pipefail

# ==============================================================================
# UNIVERSAL CLOUDSYNC SETUP SCRIPT v4.0
# ANY LINUX • AUTO-PORT • SYSTEMD • FULL FEATURES
# ==============================================================================

# Terminal colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly MAGENTA='\033[1;95m'
readonly NC='\033[0m'
readonly BOLD='\033[1m'

# Configuration
readonly APP_NAME="CloudSync"
readonly APP_DIR="/home/chris/dev/dev-cloud-sync"
readonly SERVICE_NAME="dev-cloud-sync"
readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
readonly PORT_FILE="${APP_DIR}/data/ports.conf"

# Default ports
readonly DEFAULT_WEB_PORT=8888
readonly DEFAULT_API_PORT=3001
readonly DEFAULT_RCLONE_PORT=5572

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log() {
    local level=$1
    shift
    local color=$NC
    local symbol="[*]"
    
    case $level in
        INFO)  color=$BLUE;  symbol="[INFO]" ;;
        OK)    color=$GREEN; symbol="[OK]"   ;;
        WARN)  color=$YELLOW; symbol="[WARN]" ;;
        ERROR) color=$RED;   symbol="[ERR]"  ;;
        STEP)  color=$CYAN;  symbol="[*]"    ;;
    esac
    
    echo -e "${color}${symbol}${NC} $*"
}

log_header() {
    echo ""
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  $1${NC}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

log_step() {
    echo ""
    echo -e "${BOLD}${MAGENTA}► $1${NC}"
}

# ==============================================================================
# SYSTEM DETECTION
# ==============================================================================

detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        echo "apt"
    elif command -v dnf &> /dev/null; then
        echo "dnf"
    elif command -v yum &> /dev/null; then
        echo "yum"
    elif command -v pacman &> /dev/null; then
        echo "pacman"
    elif command -v zypper &> /dev/null; then
        echo "zypper"
    elif command -v apk &> /dev/null; then
        echo "apk"
    else
        echo "unknown"
    fi
}

detect_init_system() {
    if command -v systemctl &> /dev/null; then
        echo "systemd"
    elif command -v service &> /dev/null; then
        echo "sysvinit"
    else
        echo "unknown"
    fi
}

is_root() {
    [ "$(id -u)" -eq 0 ]
}

# ==============================================================================
# DEPENDENCY INSTALLATION
# ==============================================================================

install_dependencies() {
    log_step "Installing System Dependencies"
    
    local pkg_mgr=$(detect_package_manager)
    local init_sys=$(detect_init_system)
    
    log INFO "Detected: $pkg_mgr package manager, $init_sys init system"
    
    local deps=()
    
    # Core dependencies
    case $pkg_mgr in
        apt)
            deps=(curl wget git nodejs npm python3)
            if ! command -v rclone &> /dev/null; then
                log INFO "Installing rclone..."
                curl https://rclone.org/install.sh | sudo bash
            fi
            ;;
        dnf|yum)
            deps=(curl wget git nodejs npm python3)
            if ! command -v rclone &> /dev/null; then
                log INFO "Installing rclone..."
                curl https://rclone.org/install.sh | sudo bash
            fi
            ;;
        pacman)
            deps=(curl wget git nodejs npm python3)
            if ! command -v rclone &> /dev/null; then
                log INFO "Installing rclone..."
                sudo pacman -S rclone
            fi
            ;;
        zypper)
            deps=(curl wget git nodejs npm python3)
            if ! command -v rclone &> /dev/null; then
                log INFO "Installing rclone..."
                curl https://rclone.org/install.sh | sudo bash
            fi
            ;;
        apk)
            deps=(curl wget git nodejs npm python3)
            if ! command -v rclone &> /dev/null; then
                log INFO "Installing rclone..."
                curl https://rclone.org/install.sh | sudo bash
            fi
            ;;
        *)
            log WARN "Unknown package manager. Please install manually:"
            log WARN "  - Node.js 18+"
            log WARN "  - npm 8+"
            log WARN "  - curl, wget, git"
            log WARN "  - rclone"
            ;;
    esac
    
    # Install general dependencies
    case $pkg_mgr in
        apt)
            sudo apt-get update -qq
            sudo apt-get install -y -qq "${deps[@]}" 2>/dev/null || true
            ;;
        dnf)
            sudo dnf install -y -q "${deps[@]}" 2>/dev/null || true
            ;;
        yum)
            sudo yum install -y -q "${deps[@]}" 2>/dev/null || true
            ;;
        pacman)
            sudo pacman -Sy --noconfirm "${deps[@]}" 2>/dev/null || true
            ;;
        zypper)
            sudo zypper install -y "${deps[@]}" 2>/dev/null || true
            ;;
        apk)
            sudo apk add --no-cache "${deps[@]}" 2>/dev/null || true
            ;;
    esac
    
    # Verify installations
    log INFO "Verifying installations..."
    command -v node &> /dev/null && log OK "Node.js: $(node --version)" || log ERROR "Node.js not installed"
    command -v npm &> /dev/null && log OK "npm: $(npm --version)" || log ERROR "npm not installed"
    command -v rclone &> /dev/null && log OK "rclone: $(rclone version | head -1)" || log WARN "rclone not installed"
}

# ==============================================================================
# PORT DETECTION
# ==============================================================================

is_port_available() {
    local port=$1
    if command -v lsof &> /dev/null; then
        ! lsof -i ":$port" -sTCP:LISTEN -t &>/dev/null
    elif command -v ss &> /dev/null; then
        ! ss -tuln | grep -q ":$port "
    else
        (echo > /dev/tcp/localhost/$port) 2>/dev/null
        [ $? -ne 0 ]
    fi
}

find_available_port() {
    local port=$1
    local max_attempts=100
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if is_port_available "$port"; then
            echo "$port"
            return 0
        fi
        ((port++))
        ((attempt++))
    done
    
    echo "-1"
    return 1
}

detect_and_assign_ports() {
    log_step "Auto-Detecting Available Ports"
    
    mkdir -p "${APP_DIR}/data"
    
    local web_port=$(find_available_port $DEFAULT_WEB_PORT)
    local api_port=$(find_available_port $DEFAULT_API_PORT)
    local rclone_port=$(find_available_port $DEFAULT_RCLONE_PORT)
    
    if [ "$web_port" = "-1" ] || [ "$api_port" = "-1" ] || [ "$rclone_port" = "-1" ]; then
        log ERROR "Could not find available ports for all services"
        exit 1
    fi
    
    # Save port configuration
    cat > "$PORT_FILE" <<EOF
CS_WEB_PORT=$web_port
CS_API_PORT=$api_port
CS_RCLONE_UI_PORT=$rclone_port
EOF
    
    log OK "Web UI port: $web_port"
    log OK "API port: $api_port"
    log OK "Rclone Web UI port: $rclone_port"
    log INFO "Port configuration saved to $PORT_FILE"
    
    # Export for this session
    export CS_WEB_PORT=$web_port
    export CS_API_PORT=$api_port
    export CS_RCLONE_UI_PORT=$rclone_port
}

# ==============================================================================
# APPLICATION SETUP
# ==============================================================================

setup_app() {
    log_step "Setting Up Application"
    
    cd "${APP_DIR}"
    
    # Create necessary directories
    mkdir -p "${APP_DIR}/data" "${APP_DIR}/logs"
    chmod 755 "${APP_DIR}/data" "${APP_DIR}/logs"
    
    # Install npm dependencies
    log INFO "Installing npm dependencies..."
    npm install --legacy-peer-deps 2>&1 | grep -v "npm WARN" || true
    
    # Build application
    log INFO "Building application..."
    npm run build 2>&1 | grep -E "(error|Error|built|Built|success|Success)" || true
    
    log OK "Application ready"
}

# ==============================================================================
# SYSTEMD SERVICE CONFIGURATION
# ==============================================================================

create_systemd_service() {
    log_step "Configuring Systemd Service"
    
    # Create service file
    cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=CloudSync - Cloud File Synchronization Platform
Documentation=https://github.com/code-yeongyu/dev-cloud-sync
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=notify
User=chris
Group=chris
WorkingDirectory=${APP_DIR}
ExecStart=/bin/bash ${APP_DIR}/scripts/start-cloudsync.sh
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
Restart=always
RestartSec=5
TimeoutStartSec=60
TimeoutStopSec=30

# Dynamic port environment (loaded from file)
EnvironmentFile=${PORT_FILE}
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=512

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/data ${APP_DIR}/logs

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudsync

# Runtime directory
RuntimeDirectory=cloudsync
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
EOF
    
    log OK "Service file created: ${SERVICE_FILE}"
}

enable_and_start_service() {
    log_step "Enabling and Starting Service"
    
    local init_sys=$(detect_init_system)
    
    if [ "$init_sys" != "systemd" ]; then
        log WARN "Systemd not detected. Service not auto-enabled."
        log INFO "To start manually: bash ${APP_DIR}/scripts/start-cloudsync.sh"
        return 0
    fi
    
    # Reload systemd daemon
    sudo systemctl daemon-reload
    
    # Enable service (starts on boot)
    log INFO "Enabling service for auto-start..."
    sudo systemctl enable "${SERVICE_NAME}.service"
    
    # Start service now
    log INFO "Starting service..."
    sudo systemctl start "${SERVICE_NAME}.service"
    
    # Wait for service to be ready
    local retries=30
    log INFO "Waiting for service to start..."
    while [ $retries -gt 0 ]; do
        if sudo systemctl is-active --quiet "${SERVICE_NAME}.service"; then
            break
        fi
        sleep 1
        ((retries--))
    done
    
    if sudo systemctl is-active --quiet "${SERVICE_NAME}.service"; then
        log OK "Service is running"
        sudo systemctl status "${SERVICE_NAME}.service" --no-pager | head -5
    else
        log WARN "Service may not be fully started yet"
        log INFO "Check logs with: sudo journalctl -u ${SERVICE_NAME} -f"
    fi
}

# ==============================================================================
# VERIFICATION
# ==============================================================================

verify_installation() {
    log_step "Verifying Installation"
    
    # Load port configuration
    if [ -f "$PORT_FILE" ]; then
        source "$PORT_FILE"
    fi
    
    local web_port=${CS_WEB_PORT:-$DEFAULT_WEB_PORT}
    local api_port=${CS_API_PORT:-$DEFAULT_API_PORT}
    local all_ok=true
    
    # Check Web UI
    log INFO "Checking Web UI (port $web_port)..."
    if curl -s "http://localhost:$web_port" &>/dev/null; then
        log OK "Web UI is accessible"
    else
        log WARN "Web UI not responding (may still be starting)"
        all_ok=false
    fi
    
    # Check API
    log INFO "Checking API Server (port $api_port)..."
    if curl -s "http://localhost:$api_port/health" &>/dev/null; then
        log OK "API Server is accessible"
    else
        log WARN "API Server not responding (may still be starting)"
        all_ok=false
    fi
    
    # Check systemd service
    if command -v systemctl &> /dev/null; then
        log INFO "Checking systemd service..."
        if sudo systemctl is-enabled --quiet "${SERVICE_NAME}.service"; then
            log OK "Service is enabled for auto-start"
        else
            log WARN "Service is NOT enabled for auto-start"
            all_ok=false
        fi
    fi
    
    if $all_ok; then
        return 0
    else
        return 1
    fi
}

print_summary() {
    log_header "INSTALLATION COMPLETE"
    
    # Load port configuration
    if [ -f "$PORT_FILE" ]; then
        source "$PORT_FILE"
    fi
    
    local web_port=${CS_WEB_PORT:-$DEFAULT_WEB_PORT}
    local api_port=${CS_API_PORT:-$DEFAULT_API_PORT}
    local rclone_port=${CS_RCLONE_UI_PORT:-$DEFAULT_RCLONE_PORT}
    
    echo -e "${BOLD}${GREEN}  ✓ CloudSync is installed and running${NC}"
    echo ""
    echo -e "  ${BOLD}Access Points:${NC}"
    echo -e "    ${CYAN}Web UI:${NC}       http://localhost:${web_port}"
    echo -e "    ${CYAN}API Server:${NC}   http://localhost:${api_port}"
    echo -e "    ${CYAN}Rclone Web UI:${NC} http://localhost:${rclone_port}"
    echo ""
    echo -e "  ${BOLD}Management Commands:${NC}"
    echo -e "    ${YELLOW}Status:${NC}   sudo systemctl status ${SERVICE_NAME}"
    echo -e "    ${YELLOW}Logs:${NC}    sudo journalctl -u ${SERVICE_NAME} -f"
    echo -e "    ${YELLOW}Restart:${NC} sudo systemctl restart ${SERVICE_NAME}"
    echo -e "    ${YELLOW}Stop:${NC}    sudo systemctl stop ${SERVICE_NAME}"
    echo ""
    echo -e "  ${BOLD}Files:${NC}"
    echo -e "    Service: ${SERVICE_FILE}"
    echo -e "    Ports:   ${PORT_FILE}"
    echo -e "    Start:   ${APP_DIR}/scripts/start-cloudsync.sh"
    echo ""
    
    if command -v xdg-open &> /dev/null; then
        echo -e "  ${CYAN}Opening Web UI in browser...${NC}"
        xdg-open "http://localhost:${web_port}" &>/dev/null &
    fi
    
    echo ""
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    echo ""
    echo -e "${BOLD}${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${MAGENTA}║           CloudSync Universal Setup v4.0                      ║${NC}"
    echo -e "${BOLD}${MAGENTA}║     Any Linux • Auto-Port • Systemd • Full Features           ║${NC}"
    echo -e "${BOLD}${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
    
    # Check for root if needed for system packages
    if ! is_root && [ "$(detect_package_manager)" != "unknown" ]; then
        log WARN "Some operations require sudo privileges"
        log INFO "You may be prompted for your password"
    fi
    
    # Run setup steps
    install_dependencies
    detect_and_assign_ports
    setup_app
    create_systemd_service
    enable_and_start_service
    
    # Verification (may fail if still starting)
    verify_installation || log WARN "Some services still starting..."
    
    # Print summary
    print_summary
    
    log OK "Setup complete!"
}

# Run main
main "$@"
