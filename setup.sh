#!/bin/bash
set -e

# ==============================================================================
# CLOUDSYNC COMMAND CENTER - AUTONOMOUS SETUP SYSTEM v3.1
# HIGH CONTRAST • AUTO PORT DISCOVERY • GRACEFUL • PRO-GRADE
# ==============================================================================

# High Contrast Colors
GREEN='\033[1;92m'
BLUE='\033[1;94m'
RED='\033[1;91m'
YELLOW='\033[1;93m'
CYAN='\033[1;96m'
WHITE='\033[1;97m'
MAGENTA='\033[1;95m'
RESET='\033[0m'
BOLD='\033[1m'

# Capture Project Root
PROJECT_ROOT=$(pwd)

# Port configuration with defaults and env var names
# Format: "ENV_VAR_NAME:DEFAULT_PORT:SERVICE_DESCRIPTION"
declare -a PORT_CONFIG=(
    "POSTGRES_PORT:5432:PostgreSQL Database"
    "REDIS_PORT:6379:Redis Cache"
    "LOCALSTACK_PORT:4566:LocalStack S3/SQS"
    "LOCALSTACK_PORT_ALT:4571:LocalStack Alt"
    "NGINX_HTTP_PORT:80:Nginx HTTP"
    "NGINX_HTTPS_PORT:443:Nginx HTTPS"
    "PROMETHEUS_PORT:9090:Prometheus Metrics"
    "GRAFANA_PORT:3001:Grafana Dashboard"
)

# Port search range
PORT_SEARCH_START=10000
PORT_SEARCH_END=65000

# Generated port overrides file
PORT_OVERRIDE_FILE=".docker-ports.env"

# ------------------------------------------------------------------------------
# 0. UI BOOTSTRAP
# ------------------------------------------------------------------------------

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${WHITE}${BOLD}  🔐 PRE-FLIGHT: Requesting Sudo Access for Installation...${RESET}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
sudo -v

ensure_gum() {
    if ! command -v gum &> /dev/null; then
        echo -e "${CYAN}${BOLD}[SYSTEM]${RESET} Bootstrapping Premium UI Engine (Gum)..."
        if command -v apt-get &> /dev/null; then
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg 2>/dev/null || true
            echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list > /dev/null
            sudo apt-get update -qq && sudo apt-get install gum -y -qq
        fi
    fi
}

ensure_gum

# ------------------------------------------------------------------------------
# UI HELPER FUNCTIONS - HIGH CONTRAST EDITION
# ------------------------------------------------------------------------------

log_header() {
    clear
    echo ""
    gum style \
        --foreground 46 \
        --background 0 \
        --border double \
        --border-foreground 46 \
        --padding "3 8" \
        --margin "2 6" \
        --bold \
        --align center \
        --width 90 \
        "$1"
    echo ""
}

log_title() {
    gum style \
        --foreground 201 \
        --background 0 \
        --border thick \
        --border-foreground 201 \
        --padding "2 4" \
        --margin "1 4" \
        --bold \
        --align center \
        --width 90 \
        "█▀▀ █░░ █▀█ █░█ █▀▄ █▀ █▄█ █▄░█ █▀▀" \
        "█▄▄ █▄▄ █▄█ █▄█ █▄▀ ▄█ ░█░ █░▀█ █▄▄" \
        "" \
        "DASHBOARD SETUP v3.1" \
        "AUTO PORT DISCOVERY • ZERO CONFLICTS"
}

log_step() {
    echo ""
    gum style \
        --foreground 51 \
        --background 0 \
        --bold \
        --padding "1 2" \
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    gum style \
        --foreground 226 \
        --background 0 \
        --bold \
        --padding "0 2" \
        "⚡ STEP: $1"
    gum style \
        --foreground 51 \
        --background 0 \
        --bold \
        --padding "1 2" \
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

log_info() {
    gum style --foreground 252 --bold --padding "0 4" "  ℹ️  $1"
}

log_success() {
    gum style --foreground 46 --bold --padding "0 4" "  ✅ $1"
}

log_warn() {
    gum style --foreground 214 --bold --padding "0 4" "  ⚠️  $1"
}

log_error() {
    gum style \
        --foreground 196 \
        --background 0 \
        --bold \
        --border double \
        --border-foreground 196 \
        --padding "1 3" \
        --margin "1 4" \
        "❌ ERROR: $1"
}

log_port_remap() {
    local service="$1"
    local old_port="$2"
    local new_port="$3"
    
    gum style \
        --foreground 214 \
        --bold \
        --padding "0 4" \
        "  🔄 $service: Port $old_port → $new_port (auto-remapped)"
}

run_verbose() {
    local label="$1"
    local cmd="$2"
    
    log_step "$label"
    
    local output
    local ret
    
    output=$(eval "$cmd" 2>&1) && ret=$? || ret=$?
    
    if [ -n "$output" ]; then
        echo "$output" | head -20 | while IFS= read -r line; do
            gum style --foreground 250 --padding "0 6" "$line"
        done
    fi
    
    if [ $ret -eq 0 ]; then
        log_success "$label: COMPLETE"
    else
        log_error "$label: FAILED (Exit Code: $ret)"
        return $ret
    fi
}

# ------------------------------------------------------------------------------
# INTELLIGENT PORT DISCOVERY ENGINE
# ------------------------------------------------------------------------------

is_port_available() {
    local port=$1
    ! (lsof -i ":$port" -sTCP:LISTEN -t &>/dev/null || ss -tuln | grep -q ":$port ")
}

find_available_port() {
    local start_port=$1
    local current=$start_port
    
    # First, try the original port
    if is_port_available "$current"; then
        echo "$current"
        return 0
    fi
    
    # Search in high port range
    current=$PORT_SEARCH_START
    while [ $current -lt $PORT_SEARCH_END ]; do
        if is_port_available "$current"; then
            echo "$current"
            return 0
        fi
        ((current++))
    done
    
    # Fallback: couldn't find any port
    echo "-1"
    return 1
}

get_port_user() {
    local port=$1
    local pid=$(lsof -i ":$port" -sTCP:LISTEN -t 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        local process=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
        echo "PID $pid ($process)"
    else
        echo "unknown process"
    fi
}

scan_and_assign_ports() {
    log_step "INTELLIGENT PORT DISCOVERY"
    
    log_info "Scanning system ports and resolving conflicts automatically..."
    echo ""
    
    # Clear previous overrides
    > "$PORT_OVERRIDE_FILE"
    
    local conflicts=0
    local remaps=0
    
    # Declare associative array for final port assignments
    declare -A FINAL_PORTS
    
    for config in "${PORT_CONFIG[@]}"; do
        IFS=':' read -r env_var default_port description <<< "$config"
        
        if is_port_available "$default_port"; then
            # Port is available, use default
            FINAL_PORTS[$env_var]=$default_port
            log_success "$description (port $default_port): AVAILABLE"
            echo "${env_var}=${default_port}" >> "$PORT_OVERRIDE_FILE"
        else
            # Port conflict - find alternative
            ((conflicts++))
            local blocker=$(get_port_user "$default_port")
            log_warn "$description (port $default_port): IN USE by $blocker"
            
            # Find next available port
            local new_port=$(find_available_port "$default_port")
            
            if [ "$new_port" != "-1" ]; then
                FINAL_PORTS[$env_var]=$new_port
                log_port_remap "$description" "$default_port" "$new_port"
                echo "${env_var}=${new_port}" >> "$PORT_OVERRIDE_FILE"
                ((remaps++))
            else
                log_error "Could not find available port for $description"
                return 1
            fi
        fi
    done
    
    echo ""
    
    if [ $conflicts -eq 0 ]; then
        gum style \
            --foreground 46 \
            --bold \
            --padding "1 4" \
            "🎯 All $((${#PORT_CONFIG[@]})) ports available - Zero conflicts!"
    else
        gum style \
            --foreground 214 \
            --bold \
            --border rounded \
            --border-foreground 214 \
            --padding "1 3" \
            --margin "0 4" \
            "🔧 Resolved $conflicts port conflict(s) automatically" \
            "   $remaps service(s) remapped to high ports"
    fi
    
    # Export all port variables for docker-compose
    set -a
    source "$PORT_OVERRIDE_FILE"
    set +a
    
    return 0
}

# ------------------------------------------------------------------------------
# DOCKER COMPOSE WITH DYNAMIC PORTS
# ------------------------------------------------------------------------------

run_docker_compose() {
    local action=$1
    local label=$2
    
    log_step "$label"
    
    # Source port overrides
    if [ -f "$PORT_OVERRIDE_FILE" ]; then
        set -a
        source "$PORT_OVERRIDE_FILE"
        set +a
    fi
    
    local output
    local ret
    
    output=$(docker compose --env-file "$PORT_OVERRIDE_FILE" $action 2>&1 | grep -v "attribute \`version\` is obsolete") && ret=$? || ret=$?
    
    if [ -n "$output" ]; then
        echo "$output" | while IFS= read -r line; do
            if [[ "$line" == *"Error"* ]] || [[ "$line" == *"error"* ]]; then
                gum style --foreground 196 --bold --padding "0 6" "$line"
            elif [[ "$line" == *"Started"* ]] || [[ "$line" == *"Created"* ]] || [[ "$line" == *"✔"* ]]; then
                gum style --foreground 46 --padding "0 6" "$line"
            elif [[ "$line" == *"Starting"* ]] || [[ "$line" == *"⠋"* ]]; then
                gum style --foreground 226 --padding "0 6" "$line"
            else
                gum style --foreground 250 --padding "0 6" "$line"
            fi
        done
    fi
    
    if [ $ret -eq 0 ]; then
        log_success "$label: COMPLETE"
    else
        log_error "$label: FAILED"
        log_info "Check: docker compose logs"
        return $ret
    fi
}

# ------------------------------------------------------------------------------
# EXECUTION SEQUENCE
# ------------------------------------------------------------------------------

log_header "INITIALIZING CLOUDSYNC CORE"
log_title
sleep 1

# 1. Dependency Audit
log_step "DEPENDENCY AUDIT"
deps=(git curl node rclone docker nc lsof)
for dep in "${deps[@]}"; do
    if command -v $dep &> /dev/null; then
        log_success "$dep: installed"
    else
        log_info "Missing $dep. Attempting install..."
        if [ "$dep" == "node" ]; then
            run_verbose "Installing Node.js 18" "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
        elif [ "$dep" == "rclone" ]; then
            run_verbose "Installing Rclone" "curl https://rclone.org/install.sh | sudo bash"
        elif [ "$dep" == "docker" ]; then
            run_verbose "Installing Docker" "curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER"
        elif [ "$dep" == "lsof" ] || [ "$dep" == "nc" ]; then
            run_verbose "Installing $dep" "sudo apt-get install -y $dep"
        else
            run_verbose "Installing $dep" "sudo apt-get update -qq && sudo apt-get install -y $dep"
        fi
    fi
done

# 2. Intelligent Port Discovery
scan_and_assign_ports || exit 1

# 3. Workspace Provisioning
log_header "PROVISIONING WORKSPACE"
run_verbose "Environment Configuration" "[ -f .env ] || cp .env.example .env"
run_verbose "Root Dependency Resolution" "npm install --legacy-peer-deps 2>&1 | tail -5"

# 4. Dashboard Compilation
log_header "COMPILING UNIFIED DASHBOARD"
run_verbose "Web Assets Installation" "cd apps/web && npm install 2>&1 | tail -3"
run_verbose "Vite Production Build" "cd apps/web && npm run build 2>&1 | tail -5"

# 5. Infrastructure Deployment
log_header "DEPLOYING INFRASTRUCTURE"
run_docker_compose "down --remove-orphans" "Cleaning Stale Containers"
run_docker_compose "up -d" "Starting Service Containers"

# 6. API Logic Compilation
log_header "COMPILING API SERVICES"
run_verbose "Backend TypeScript Build" "npm run build --if-present 2>&1 | tail -5"

# 7. System Persistence (Systemd)
log_header "CONFIGURING SYSTEM PERSISTENCE"
SERVICE_SRC="config/dev-cloud-sync-ui.service"
SERVICE_DEST="/etc/systemd/system/dev-cloud-sync-ui.service"

if [ -f "$SERVICE_SRC" ]; then
    run_verbose "Systemd Service Transfer" "sudo cp $SERVICE_SRC $SERVICE_DEST"
    run_verbose "Systemd Daemon Reload" "sudo systemctl daemon-reload"
    run_verbose "Systemd Service Enable" "sudo systemctl enable dev-cloud-sync-ui.service 2>&1 || true"
    run_verbose "Systemd Service Start" "sudo systemctl restart dev-cloud-sync-ui.service 2>&1 || true"
    log_success "CloudSync Managed Service is LIVE."
else
    log_warn "Missing service definition: $SERVICE_SRC - Skipping systemd setup"
fi

# 8. Deployment Finalization
log_header "DEPLOYMENT COMPLETE"

# Load final port assignments
source "$PORT_OVERRIDE_FILE"

log_info "Stabilizing Dashboard Gateway (Port 8888)..."

gum spin --spinner dot --title "Waiting for dashboard to come online..." -- bash -c '
    retries=30
    while ! nc -z localhost 8888 2>/dev/null && [ $retries -gt 0 ]; do
        sleep 1
        retries=$((retries - 1))
    done
'

DASHBOARD_URL="http://localhost:8888"
GRAFANA_URL="http://localhost:${GRAFANA_PORT:-3001}"
PROMETHEUS_URL="http://localhost:${PROMETHEUS_PORT:-9090}"

if nc -z localhost 8888 2>/dev/null; then
    gum style \
        --foreground 46 \
        --background 0 \
        --border double \
        --border-foreground 46 \
        --padding "3 6" \
        --margin "2 6" \
        --bold \
        --align center \
        --width 90 \
        "🎉 DEPLOYMENT SUCCESSFUL 🎉" \
        "" \
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" \
        "" \
        "🌐 DASHBOARD:   $DASHBOARD_URL" \
        "📊 GRAFANA:     $GRAFANA_URL" \
        "🔥 PROMETHEUS:  $PROMETHEUS_URL" \
        "" \
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" \
        "" \
        "MANAGED SERVICE: ✅ ACTIVE"
    
    if command -v xdg-open &> /dev/null; then
        xdg-open "$DASHBOARD_URL" &> /dev/null &
    fi
else
    log_warn "Dashboard taking longer than expected to respond."
    log_info "Try manually: sudo systemctl status dev-cloud-sync-ui"
fi

echo ""
gum style --foreground 226 --bold --padding "0 4" "  🛠️  SERVICE MANAGEMENT:"
gum style --foreground 255 --padding "0 6" "  status:  sudo systemctl status dev-cloud-sync-ui"
gum style --foreground 255 --padding "0 6" "  logs:    sudo journalctl -u dev-cloud-sync-ui -f"
gum style --foreground 255 --padding "0 6" "  docker:  docker compose ps"
gum style --foreground 255 --padding "0 6" "  ports:   cat $PORT_OVERRIDE_FILE"
echo ""

# Show port summary
gum style --foreground 51 --bold --padding "0 4" "  📌 ACTIVE PORT ASSIGNMENTS:"
cat "$PORT_OVERRIDE_FILE" | while IFS='=' read -r var port; do
    gum style --foreground 250 --padding "0 6" "  $var = $port"
done
echo ""

sleep 3
exit 0
