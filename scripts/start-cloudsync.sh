#!/bin/bash
#
# CloudSync Startup Script
# Auto-detects available ports and starts all services
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
APP_DIR="/home/chris/dev/dev-cloud-sync"
DATA_DIR="${APP_DIR}/data"
LOG_DIR="${APP_DIR}/logs"

# Default ports (will be auto-adjusted if taken)
DEFAULT_WEB_PORT=8888
DEFAULT_API_PORT=3001
DEFAULT_RCLONE_UI_PORT=5572

# Runtime ports (exported for services)
export CS_WEB_PORT
export CS_API_PORT
export CS_RCLONE_UI_PORT

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if a port is available
is_port_available() {
    local port=$1
    if command -v lsof &> /dev/null; then
        ! lsof -i ":$port" -sTCP:LISTEN -t &>/dev/null
    elif command -v ss &> /dev/null; then
        ! ss -tuln | grep -q ":$port "
    elif command -v netstat &> /dev/null; then
        ! netstat -tuln | grep -q ":$port "
    else
        # Fallback: try to bind
        (echo > /dev/tcp/localhost/$port) 2>/dev/null
        [ $? -ne 0 ]
    fi
}

# Find first available port starting from given port
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

# Auto-detect and assign ports
detect_ports() {
    log_info "Detecting available ports..."
    
    # Web UI Port
    CS_WEB_PORT=$(find_available_port $DEFAULT_WEB_PORT)
    if [ "$CS_WEB_PORT" = "-1" ]; then
        log_error "Could not find available port for Web UI"
        exit 1
    fi
    if [ "$CS_WEB_PORT" != "$DEFAULT_WEB_PORT" ]; then
        log_warn "Web UI port changed: $DEFAULT_WEB_PORT -> $CS_WEB_PORT"
    else
        log_success "Web UI port: $CS_WEB_PORT"
    fi
    
    # API Server Port
    CS_API_PORT=$(find_available_port $DEFAULT_API_PORT)
    if [ "$CS_API_PORT" = "-1" ]; then
        log_error "Could not find available port for API Server"
        exit 1
    fi
    if [ "$CS_API_PORT" != "$DEFAULT_API_PORT" ]; then
        log_warn "API port changed: $DEFAULT_API_PORT -> $CS_API_PORT"
    else
        log_success "API port: $CS_API_PORT"
    fi
    
    # Rclone Web UI Port
    CS_RCLONE_UI_PORT=$(find_available_port $DEFAULT_RCLONE_UI_PORT)
    if [ "$CS_RCLONE_UI_PORT" = "-1" ]; then
        log_error "Could not find available port for Rclone Web UI"
        exit 1
    fi
    if [ "$CS_RCLONE_UI_PORT" != "$DEFAULT_RCLONE_UI_PORT" ]; then
        log_warn "Rclone Web UI port changed: $DEFAULT_RCLONE_UI_PORT -> $CS_RCLONE_UI_PORT"
    else
        log_success "Rclone Web UI port: $CS_RCLONE_UI_PORT"
    fi
    
    # Export for child processes
    export CS_WEB_PORT CS_API_PORT CS_RCLONE_UI_PORT
    
    # Save port configuration
    mkdir -p "$DATA_DIR"
    cat > "$DATA_DIR/ports.conf" <<EOF
CS_WEB_PORT=$CS_WEB_PORT
CS_API_PORT=$CS_API_PORT
CS_RCLONE_UI_PORT=$CS_RCLONE_UI_PORT
EOF
    
    log_info "Port configuration saved to $DATA_DIR/ports.conf"
}

# Create required directories
setup_directories() {
    log_info "Setting up directories..."
    mkdir -p "$DATA_DIR" "$LOG_DIR"
    chmod 755 "$DATA_DIR" "$LOG_DIR"
    log_success "Directories ready"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing=0
    
    # Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18+"
        missing=1
    else
        log_success "Node.js: $(node --version)"
    fi
    
    # npm
    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        missing=1
    else
        log_success "npm: $(npm --version)"
    fi
    
    # rclone
    if ! command -v rclone &> /dev/null; then
        log_warn "rclone not found. Installing..."
        if command -v curl &> /dev/null; then
            curl https://rclone.org/install.sh | sudo bash || true
        fi
    else
        log_success "rclone: $(rclone version | head -1)"
    fi
    
    if [ $missing -eq 1 ]; then
        log_error "Missing required dependencies"
        exit 1
    fi
}

# Build application if needed
build_app() {
    if [ ! -d "${APP_DIR}/apps/web/dist" ]; then
        log_info "Building web application..."
        cd "${APP_DIR}"
        npm run build --if-present
        log_success "Build complete"
    else
        log_info "Using existing build"
    fi
}

# Start API server
start_api_server() {
    log_info "Starting API server on port $CS_API_PORT..."
    cd "${APP_DIR}/packages/api-server"
    
    # Start in background
    NODE_ENV=production PORT=$CS_API_PORT node src/index.js &
    API_PID=$!
    
    # Wait for API to be ready
    local retries=30
    while ! curl -s "http://localhost:$CS_API_PORT/health" &>/dev/null; do
        sleep 0.5
        retries=$((retries - 1))
        if [ $retries -eq 0 ]; then
            log_error "API server failed to start"
            return 1
        fi
    done
    
    log_success "API server running (PID: $API_PID)"
    echo $API_PID > "${DATA_DIR}/api.pid"
}

# Start web UI server
start_web_ui() {
    log_info "Starting web UI on port $CS_WEB_PORT..."
    
    # Use Vite preview or serve built files
    cd "${APP_DIR}/apps/web"
    
    if [ -f "node_modules/.bin/vite" ]; then
        PORT=$CS_WEB_PORT npm run preview -- --port $CS_WEB_PORT &
        WEB_PID=$!
    elif command -v serve &> /dev/null; then
        serve -s dist -l $CS_WEB_PORT &
        WEB_PID=$!
    else
        # Fallback: simple python server
        cd "${APP_DIR}/apps/web/dist"
        python3 -m http.server $CS_WEB_PORT &
        WEB_PID=$!
    fi
    
    # Wait for web UI to be ready
    local retries=30
    while ! curl -s "http://localhost:$CS_WEB_PORT" &>/dev/null; do
        sleep 0.5
        retries=$((retries - 1))
        if [ $retries -eq 0 ]; then
            log_error "Web UI server failed to start"
            return 1
        fi
    done
    
    log_success "Web UI running (PID: $WEB_PID)"
    echo $WEB_PID > "${DATA_DIR}/web.pid"
}

# Start Rclone Web UI (if configured)
start_rclone_ui() {
    log_info "Starting Rclone Web UI on port $CS_RCLONE_UI_PORT..."
    
    # Check if rclone web UI is available
    if command -v rclone &> /dev/null; then
        rclone rcd --rc-web-gui --rc-addr ":$CS_RCLONE_UI_PORT" --rc-user="cloudsync" --rc-pass="${RCLONE_PASSWORD:-cloudsync123}" --rc-serve --daemon &
        RCLONE_PID=$!
        
        sleep 2
        
        if curl -s "http://localhost:$CS_RCLONE_UI_PORT" &>/dev/null; then
            log_success "Rclone Web UI running (PID: $RCLONE_PID)"
            echo $RCLONE_PID > "${DATA_DIR}/rclone.pid"
        else
            log_warn "Rclone Web UI failed to start"
            kill $RCLONE_PID 2>/dev/null || true
        fi
    else
        log_warn "Rclone not found, skipping Rclone Web UI"
    fi
}

# Cleanup function
cleanup() {
    log_info "Shutting down services..."
    
    for pid_file in "${DATA_DIR}"/*.pid; do
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 $pid 2>/dev/null; then
                kill $pid 2>/dev/null || true
                log_info "Stopped process $pid"
            fi
            rm -f "$pid_file"
        fi
    done
    
    log_success "All services stopped"
    exit 0
}

# Print status
print_status() {
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  CloudSync Status${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${CYAN}Web UI:${NC}       http://localhost:${CS_WEB_PORT}"
    echo -e "  ${CYAN}API Server:${NC}   http://localhost:${CS_API_PORT}"
    echo -e "  ${CYAN}Rclone Web UI:${NC} http://localhost:${CS_RCLONE_UI_PORT}"
    echo ""
    echo -e "  ${GREEN}All services running${NC}"
    echo ""
    echo -e "  ${YELLOW}Management:${NC}"
    echo -e "    Stop:    Ctrl+C"
    echo -e "    Status:  systemctl status dev-cloud-sync"
    echo -e "    Logs:    journalctl -u dev-cloud-sync -f"
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║                    CloudSync Startup                        ║${NC}"
    echo -e "${BOLD}${CYAN}║           Auto-Port Detection & Service Launch             ║${NC}"
    echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Setup
    setup_directories
    check_dependencies
    detect_ports
    build_app
    
    # Start services
    start_api_server
    start_web_ui
    start_rclone_ui
    
    # Print status
    print_status
    
    # Setup signal handlers
    trap cleanup SIGINT SIGTERM
    
    # Wait and monitor
    while true; do
        sleep 10
        
        # Check if processes are still running
        for pid_file in "${DATA_DIR}"/*.pid; do
            if [ -f "$pid_file" ]; then
                local pid=$(cat "$pid_file")
                if ! kill -0 $pid 2>/dev/null; then
                    log_warn "Process $pid died, restarting..."
                    # Restart logic could go here
                fi
            fi
        done
    done
}

# Run main
main "$@"
