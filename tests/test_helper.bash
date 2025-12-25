#!/usr/bin/env bats
# Test helper functions for BATS testing

# Mock common system commands for testing
mock_commands() {
    # Create mock binaries directory
    mkdir -p "$TEST_TEMP_DIR/mock-bin"
    export PATH="$TEST_TEMP_DIR/mock-bin:$PATH"

    # Mock which command
    cat > "$TEST_TEMP_DIR/mock-bin/which" << 'EOF'
#!/bin/bash
case "$1" in
    "python3"|"pip3"|"systemctl"|"curl"|"wget")
        echo "/usr/bin/$1"
        ;;
    "aws"|"gcloud"|"az")
        echo "/usr/local/bin/$1"
        ;;
    *)
        exit 1
        ;;
esac
EOF

    # Mock systemctl command
    cat > "$TEST_TEMP_DIR/mock-bin/systemctl" << 'EOF'
#!/bin/bash
case "$1" in
    "is-active")
        echo "inactive"
        exit 3
        ;;
    "enable"|"disable"|"start"|"stop"|"daemon-reload")
        echo "Mock systemctl $1 $2"
        exit 0
        ;;
    *)
        echo "Unknown systemctl command: $1"
        exit 1
        ;;
esac
EOF

    # Mock curl command
    cat > "$TEST_TEMP_DIR/mock-bin/curl" << 'EOF'
#!/bin/bash
if [[ "$*" =~ "--connect-timeout" ]]; then
    echo '{"status": "ok"}'
    exit 0
else
    echo "Mock curl response"
    exit 0
fi
EOF

    # Mock python3 command
    cat > "$TEST_TEMP_DIR/mock-bin/python3" << 'EOF'
#!/bin/bash
if [[ "$*" =~ "--version" ]]; then
    echo "Python 3.9.7"
else
    command python3 "$@"
fi
EOF

    # Mock pip3 command
    cat > "$TEST_TEMP_DIR/mock-bin/pip3" << 'EOF'
#!/bin/bash
echo "Mock pip3 install $*"
exit 0
EOF

    # Make all mock commands executable
    chmod +x "$TEST_TEMP_DIR/mock-bin"/*
}

# Create a mock filesystem structure for testing
create_mock_filesystem() {
    local base_dir="$1"

    # Create directory structure
    mkdir -p "$base_dir"/{bin,etc,var/log,lib,share}

    # Create mock system files
    mkdir -p "$base_dir/etc/systemd/system"
    mkdir -p "$base_dir/etc/logrotate.d"
    mkdir -p "$base_dir/usr/local/bin"

    # Create mock cloud-sync files
    touch "$base_dir/bin/cloud-sync"
    touch "$base_dir/bin/cloud-sync-daemon"
    touch "$base_dir/lib/cloud-sync/config.py"
    touch "$base_dir/lib/cloud-sync/sync.py"
}

# Simulate different Linux distributions
simulate_distribution() {
    local distro="$1"
    local release_file="/etc/os-release"

    case "$distro" in
        "ubuntu")
            cat > "$release_file" << EOF
NAME="Ubuntu"
VERSION="20.04.3 LTS (Focal Fossa)"
ID=ubuntu
ID_LIKE=debian
EOF
            ;;
        "centos")
            cat > "$release_file" << EOF
NAME="CentOS Linux"
VERSION="8"
ID="centos"
ID_LIKE="rhel fedora"
EOF
            ;;
        "debian")
            cat > "$release_file" << EOF
PRETTY_NAME="Debian GNU/Linux 11 (bullseye)"
NAME="Debian GNU/Linux"
VERSION_ID="11"
VERSION="11 (bullseye)"
ID=debian
EOF
            ;;
    esac
}

# Check if command exists in the system
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Wait for a service to be available
wait_for_service() {
    local service="$1"
    local timeout="${2:-30}"
    local count=0

    while [ $count -lt $timeout ]; do
        if systemctl is-active --quiet "$service"; then
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    return 1
}

# Create test files of various sizes
create_test_files() {
    local directory="$1"
    local count="${2:-10}"
    local size="${3:-1024}"

    for i in $(seq 1 $count); do
        dd if=/dev/zero of="$directory/test_file_$i" bs=$size count=1 2>/dev/null
    done
}

# Generate random test data
generate_random_data() {
    local size="$1"
    local output="$2"

    if command_exists openssl; then
        openssl rand -base64 $((size * 3 / 4)) | head -c $size > "$output"
    else
        dd if=/dev/urandom of="$output" bs=$size count=1 2>/dev/null
    fi
}

# Check if port is available
port_available() {
    local port="$1"
    local timeout="${2:-5}"

    if command_exists nc; then
        ! nc -z localhost "$port" &>/dev/null
        return $?
    elif command_exists ss; then
        ! ss -ln | grep -q ":$port "
        return $?
    else
        ! lsof -i ":$port" &>/dev/null
        return $?
    fi
}

# Cleanup function for test environments
cleanup_test_env() {
    local test_dir="$1"

    # Kill any processes using the test directory
    if command_exists lsof; then
        lsof +D "$test_dir" 2>/dev/null | awk 'NR>1 {print $2}' | xargs -r kill -9
    fi

    # Remove test directory
    rm -rf "$test_dir"

    # Cleanup any mock binaries
    if [ -d "$TEST_TEMP_DIR/mock-bin" ]; then
        rm -rf "$TEST_TEMP_DIR/mock-bin"
    fi
}

# Validate file permissions
validate_permissions() {
    local file="$1"
    local expected_perms="$2"

    local actual_perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null)
    [ "$actual_perms" = "$expected_perms" ]
}

# Check file ownership
validate_ownership() {
    local file="$1"
    local expected_owner="$2"

    local actual_owner=$(stat -c "%U:%G" "$file" 2>/dev/null || stat -f "%Su:%Sg" "$file" 2>/dev/null)
    [ "$actual_owner" = "$expected_owner" ]
}

# Generate test configuration
generate_test_config() {
    local output_file="$1"

    cat > "$output_file" << EOF
# Test Configuration for Cloud Sync System
sync:
  source_directory: "/tmp/test-sync/source"
  target_directory: "/tmp/test-sync/target"
  interval: 30
  conflict_resolution: "latest_wins"

cloud_providers:
  aws:
    enabled: true
    region: "us-east-1"
    bucket: "test-bucket"
  gcp:
    enabled: false
    project_id: "test-project"
  azure:
    enabled: false

logging:
  level: "DEBUG"
  file: "/tmp/test-sync/cloud-sync.log"
  max_size: "10MB"
  backup_count: 5

security:
  encryption_enabled: true
  checksum_algorithm: "sha256"
EOF
}

# Create a mock cloud service endpoint
create_mock_cloud_service() {
    local port="$1"
    local service_type="$2"

    if command_exists python3; then
        python3 - << EOF &
import http.server
import socketserver
import json
from urllib.parse import urlparse

class MockCloudHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/list'):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'files': ['test1.txt', 'test2.txt'],
                'total_size': 2048
            }).encode())
        elif self.path.startswith('/health'):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'Upload successful')

with socketserver.TCPServer(("", $port), MockCloudHandler) as httpd:
    httpd.serve_forever()
EOF

        # Wait for server to start
        sleep 2
    fi
}

# Stop mock cloud service
stop_mock_cloud_service() {
    pkill -f "MockCloudHandler" 2>/dev/null || true
}