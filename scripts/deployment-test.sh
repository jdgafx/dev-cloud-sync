#!/bin/bash
# Comprehensive deployment testing script for multiple Linux distributions

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"
LOG_FILE="$TEST_RESULTS_DIR/deployment-test.log"

# Test configuration
DISTRIBUTIONS=(
    "ubuntu:20.04"
    "ubuntu:22.04"
    "ubuntu:24.04"
    "debian:11"
    "debian:12"
    "centos:8"
    "centos:9"
    "fedora:38"
    "fedora:39"
    "fedora:40"
    "archlinux:latest"
    "opensuse/leap:15.5"
    "alpine:3.18"
)

INSTALLATION_TYPES=(
    "system"
    "user"
    "docker"
)

TEST_SCENARIOS=(
    "fresh_install"
    "upgrade"
    "rollback"
    "config_migration"
)

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        *)
            echo "[$level] $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Check if Docker is available
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        log "ERROR" "Docker is not installed or not in PATH"
        return 1
    fi

    if ! docker info >/dev/null 2>&1; then
        log "ERROR" "Docker daemon is not running"
        return 1
    fi

    return 0
}

# Pull Docker image if not available
pull_docker_image() {
    local image="$1"
    log "INFO" "Pulling Docker image: $image"

    if ! docker pull "$image" 2>/dev/null; then
        log "ERROR" "Failed to pull Docker image: $image"
        return 1
    fi

    return 0
}

# Run deployment test for a specific distribution
test_distribution() {
    local distro="$1"
    local install_type="$2"
    local scenario="$3"
    local test_name="${distro//:/_}_${install_type}_${scenario}"
    local test_log="$TEST_RESULTS_DIR/${test_name}.log"
    local container_name="cloud-sync-test-$(date +%s)-$$"

    log "INFO" "Starting test: $test_name"

    # Create test container
    local docker_args=(
        "--name" "$container_name"
        "--detach"
        "--privileged"
        "-v" "$PROJECT_ROOT:/workspace:ro"
        "-v" "$TEST_RESULTS_DIR:/results"
    )

    # Add distro-specific mounts if needed
    case "$distro" in
        "centos:"*|"rhel:"*)
            docker_args+=("-v" "/sys/fs/cgroup:/sys/fs/cgroup:ro")
            ;;
    esac

    # Start container
    if ! docker run "${docker_args[@]}" "$distro" tail -f /dev/null >/dev/null; then
        log "ERROR" "Failed to start container for $distro"
        return 1
    fi

    # Test cleanup function
    cleanup_container() {
        log "INFO" "Cleaning up container: $container_name"
        docker stop "$container_name" >/dev/null 2>&1 || true
        docker rm "$container_name" >/dev/null 2>&1 || true
    }
    trap cleanup_container EXIT

    # Prepare container environment
    log "INFO" "Preparing container environment for $distro"

    # Install dependencies inside container
    case "$distro" in
        "ubuntu:"*|"debian:"*)
            docker exec "$container_name" bash -c "
                apt-get update -qq
                apt-get install -y curl wget python3 python3-pip systemd
            " 2>&1 | tee -a "$test_log"
            ;;
        "centos:"*|"rhel:"*|"fedora:"*)
            docker exec "$container_name" bash -c "
                dnf update -y -q
                dnf install -y curl wget python3 python3-pip systemd
            " 2>&1 | tee -a "$test_log"
            ;;
        "archlinux:"*)
            docker exec "$container_name" bash -c "
                pacman -Sy --noconfirm
                pacman -S --noconfirm curl wget python python-pip systemd
            " 2>&1 | tee -a "$test_log"
            ;;
        "alpine:"*)
            docker exec "$container_name" bash -c "
                apk update --no-cache
                apk add --no-cache curl wget python3 py3-pip
            " 2>&1 | tee -a "$test_log"
            ;;
        "opensuse/"*)
            docker exec "$container_name" bash -c "
                zypper refresh -q
                zypper install -y curl wget python3 python3-pip systemd
            " 2>&1 | tee -a "$test_log"
            ;;
    esac

    # Copy installation script to container
    docker cp "/workspace/install.sh" "$container_name:/tmp/install.sh"
    docker exec "$container_name" chmod +x /tmp/install.sh

    # Run installation based on type and scenario
    local install_args=()
    local test_result=0

    case "$install_type" in
        "system")
            install_args+=("--install-dir" "/opt/cloud-sync")
            ;;
        "user")
            install_args+=("--user")
            ;;
        "docker")
            # Docker installation would be handled differently
            log "INFO" "Testing Docker deployment scenario"
            install_args+=("--docker")
            ;;
    esac

    case "$scenario" in
        "fresh_install")
            install_args+=("--dry-run" "--verbose")
            ;;
        "upgrade")
            # First install older version, then upgrade
            log "INFO" "Testing upgrade scenario for $distro"
            docker exec "$container_name" /tmp/install.sh "${install_args[@]}" 2>&1 | tee -a "$test_log"
            ;;
        "rollback")
            install_args+=("--backup" "--allow-rollback")
            ;;
        "config_migration")
            install_args+=("--migrate-config")
            ;;
    esac

    # Execute installation test
    log "INFO" "Running installation with args: ${install_args[*]}"

    if docker exec "$container_name" /tmp/install.sh "${install_args[@]}" 2>&1 | tee -a "$test_log"; then
        log "SUCCESS" "Installation test passed for $test_name"
        echo "PASSED" > "$TEST_RESULTS_DIR/${test_name}.status"
        test_result=0
    else
        log "ERROR" "Installation test failed for $test_name"
        echo "FAILED" > "$TEST_RESULTS_DIR/${test_name}.status"
        test_result=1
    fi

    # Run post-installation tests
    if [ "$test_result" -eq 0 ]; then
        test_post_installation "$container_name" "$distro" "$install_type" "$test_name"
    fi

    return "$test_result"
}

# Post-installation testing
test_post_installation() {
    local container="$1"
    local distro="$2"
    local install_type="$3"
    local test_name="$4"
    local post_test_log="$TEST_RESULTS_DIR/${test_name}_post_install.log"

    log "INFO" "Running post-installation tests for $test_name"

    local post_test_result=0

    # Test 1: Check if binaries are created
    log "INFO" "Testing binary creation"
    if docker exec "$container"" bash -c "
        if [ '$install_type' = 'system' ]; then
            [ -f /opt/cloud-sync/bin/cloud-sync ] || exit 1
        else
            [ -f ~/.local/bin/cloud-sync ] || exit 1
        fi
    " 2>&1 | tee -a "$post_test_log"; then
        log "SUCCESS" "Binary creation test passed"
    else
        log "ERROR" "Binary creation test failed"
        post_test_result=1
    fi

    # Test 2: Check configuration files
    log "INFO" "Testing configuration files"
    if docker exec "$container" bash -c "
        if [ '$install_type' = 'system' ]; then
            [ -f /etc/cloud-sync/config.yml ] || exit 1
        else
            [ -f ~/.config/cloud-sync/config.yml ] || exit 1
        fi
    " 2>&1 | tee -a "$post_test_log"; then
        log "SUCCESS" "Configuration files test passed"
    else
        log "ERROR" "Configuration files test failed"
        post_test_result=1
    fi

    # Test 3: Test systemd service (if applicable)
    if [ "$install_type" = "system" ]; then
        log "INFO" "Testing systemd service"
        if docker exec "$container" bash -c "
            systemctl daemon-reload
            systemctl status cloud-sync || exit 1
        " 2>&1 | tee -a "$post_test_log"; then
            log "SUCCESS" "Systemd service test passed"
        else
            log "WARN" "Systemd service test failed (may be expected in container)"
        fi
    fi

    # Test 4: Test basic functionality
    log "INFO" "Testing basic functionality"
    if docker exec "$container" bash -c "
        if [ '$install_type' = 'system' ]; then
            /opt/cloud-sync/bin/cloud-sync --version || exit 1
        else
            ~/.local/bin/cloud-sync --version || exit 1
        fi
    " 2>&1 | tee -a "$post_test_log"; then
        log "SUCCESS" "Basic functionality test passed"
    else
        log "ERROR" "Basic functionality test failed"
        post_test_result=1
    fi

    echo "$post_test_result" > "$TEST_RESULTS_DIR/${test_name}_post_install.status"
    return "$post_test_result"
}

# Generate test report
generate_report() {
    local report_file="$TEST_RESULTS_DIR/deployment-test-report.html"
    local json_file="$TEST_RESULTS_DIR/deployment-test-report.json"

    log "INFO" "Generating test report"

    # Generate JSON report first
    python3 - << EOF
import json
import os
from datetime import datetime

results_dir = "$TEST_RESULTS_DIR"
report = {
    "timestamp": datetime.now().isoformat(),
    "summary": {
        "total_tests": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0
    },
    "results": []
}

for status_file in os.listdir(results_dir):
    if status_file.endswith('.status'):
        test_name = status_file.replace('.status', '')
        status = open(os.path.join(results_dir, status_file)).read().strip()

        result = {
            "test_name": test_name,
            "status": status,
            "log_file": f"{test_name}.log"
        }

        if status == "PASSED":
            report["summary"]["passed"] += 1
        elif status == "FAILED":
            report["summary"]["failed"] += 1
        else:
            report["summary"]["skipped"] += 1

        report["summary"]["total_tests"] += 1
        report["results"].append(result)

with open("$json_file", "w") as f:
    json.dump(report, f, indent=2)

print(f"JSON report generated: {report['summary']}")
EOF

    # Generate HTML report
    cat > "$report_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Sync Deployment Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0; color: #495057; }
        .metric .value { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #6c757d; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .status-passed { color: #28a745; font-weight: bold; }
        .status-failed { color: #dc3545; font-weight: bold; }
        .status-skipped { color: #6c757d; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Cloud Sync System Deployment Test Report</h1>
        <p>Generated on: <span id="timestamp"></span></p>
    </div>

    <div class="summary" id="summary">
        <!-- Summary will be populated by JavaScript -->
    </div>

    <h2>Test Results</h2>
    <table id="results-table">
        <thead>
            <tr>
                <th>Test Name</th>
                <th>Distribution</th>
                <th>Installation Type</th>
                <th>Scenario</th>
                <th>Status</th>
                <th>Log File</th>
            </tr>
        </thead>
        <tbody id="results-tbody">
            <!-- Results will be populated by JavaScript -->
        </tbody>
    </table>

    <script>
        // Load and display test results
        fetch('deployment-test-report.json')
            .then(response => response.json())
            .then(data => {
                document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();

                // Update summary
                const summary = data.summary;
                document.getElementById('summary').innerHTML = \`
                    <div class="metric">
                        <h3>Total Tests</h3>
                        <div class="value">\${summary.total_tests}</div>
                    </div>
                    <div class="metric">
                        <h3>Passed</h3>
                        <div class="value passed">\${summary.passed}</div>
                    </div>
                    <div class="metric">
                        <h3>Failed</h3>
                        <div class="value failed">\${summary.failed}</div>
                    </div>
                    <div class="metric">
                        <h3>Skipped</h3>
                        <div class="value skipped">\${summary.skipped}</div>
                    </div>
                \`;

                // Update results table
                const tbody = document.getElementById('results-tbody');
                data.results.forEach(result => {
                    const parts = result.test_name.split('_');
                    const distro = parts.slice(0, -2).join('_');
                    const installType = parts.slice(-2, -1)[0];
                    const scenario = parts.slice(-1)[0];

                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td>\${result.test_name}</td>
                        <td>\${distro}</td>
                        <td>\${installType}</td>
                        <td>\${scenario}</td>
                        <td class="status-\${result.status.toLowerCase()}">\${result.status}</td>
                        <td><a href="\${result.log_file}">\${result.log_file}</a></td>
                    \`;
                    tbody.appendChild(row);
                });
            })
            .catch(error => console.error('Error loading test results:', error));
    </script>
</body>
</html>
EOF

    log "SUCCESS" "HTML report generated: $report_file"
}

# Main execution
main() {
    log "INFO" "Starting Cloud Sync deployment testing"

    # Check dependencies
    if ! check_docker; then
        log "ERROR" "Docker check failed. Exiting."
        exit 1
    fi

    local total_tests=0
    local passed_tests=0
    local failed_tests=0

    # Run tests for all combinations
    for distro in "${DISTRIBUTIONS[@]}"; do
        if ! pull_docker_image "$distro"; then
            log "WARN" "Skipping $distro (failed to pull image)"
            continue
        fi

        for install_type in "${INSTALLATION_TYPES[@]}"; do
            for scenario in "${TEST_SCENARIOS[@]}"; do
                ((total_tests++))

                if test_distribution "$distro" "$install_type" "$scenario"; then
                    ((passed_tests++))
                else
                    ((failed_tests++))
                fi

                # Small delay between tests
                sleep 2
            done
        done
    done

    # Generate final report
    generate_report

    # Print summary
    log "INFO" "Testing completed. Summary:"
    log "INFO" "  Total tests: $total_tests"
    log "INFO" "  Passed: $passed_tests"
    log "INFO" "  Failed: $failed_tests"

    if [ "$failed_tests" -gt 0 ]; then
        log "ERROR" "Some tests failed. Check logs for details."
        exit 1
    else
        log "SUCCESS" "All tests passed!"
        exit 0
    fi
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi