#!/usr/bin/env bats
# BATS test file for install.sh script

load test_helper

setup() {
    # Create temporary directory for tests
    TEST_TEMP_DIR=$(mktemp -d)
    export TEST_TEMP_DIR

    # Copy install script to test directory
    cp /home/chris/dev/cloud-sync-system/install.sh "$TEST_TEMP_DIR/"
    cd "$TEST_TEMP_DIR"

    # Mock common commands for testing
    mock_commands
}

teardown() {
    # Clean up temporary directory
    rm -rf "$TEST_TEMP_DIR"
}

@test "install script exists and is executable" {
    [ -f "install.sh" ]
    [ -x "install.sh" ]
}

@test "install script shows help when requested" {
    run ./install.sh --help
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Usage:" ]]
    [[ "$output" =~ "--help" ]]
    [[ "$output" =~ "--verbose" ]]
    [[ "$output" =~ "--dry-run" ]]
}

@test "install script validates installation directory" {
    # Test with non-existent parent directory
    run ./install.sh --install-dir "/nonexistent/path/cloud-sync"
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Parent directory does not exist" ]]
}

@test "install script creates directories in dry-run mode" {
    run ./install.sh --dry-run --install-dir "$TEST_TEMP_DIR/test-install"
    [ "$status" -eq 0 ]
    [[ "$output" =~ "DRY RUN: Would create directory" ]]
    [[ "$output" =~ "DRY RUN: Would copy files" ]]
}

@test "install script detects existing installation" {
    # Create mock existing installation
    mkdir -p "$TEST_TEMP_DIR/existing-install/bin"
    touch "$TEST_TEMP_DIR/existing-install/bin/cloud-sync"

    run ./install.sh --install-dir "$TEST_TEMP_DIR/existing-install"
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Installation already exists" ]]
}

@test "install script validates Python version" {
    # Mock Python version check
    run bash -c 'echo "python3.7" > /tmp/mock_python_version'

    run ./install.sh --python-version "3.7"
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Python 3.8 or higher is required" ]]
}

@test "install script handles user installation mode" {
    run ./install.sh --user --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" =~ "$HOME/.local/share/cloud-sync" ]]
    [[ "$output" =~ "$HOME/.config/cloud-sync" ]]
}

@test "install script checks system dependencies" {
    # Mock missing dependencies
    run bash -c 'echo "MISSING" > /tmp/mock_which_output'

    run ./install.sh --dry-run
    # Should check for required commands
    [[ "$output" =~ "Checking system dependencies" ]]
}

@test "install script handles permission errors gracefully" {
    # Create directory without write permissions
    mkdir -p "$TEST_TEMP_DIR/readonly"
    chmod 444 "$TEST_TEMP_DIR/readonly"

    run ./install.sh --install-dir "$TEST_TEMP_DIR/readonly/install"
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Permission denied" ]]
}

@test "install script validates configuration files" {
    # Create invalid configuration
    echo "invalid-yaml-content" > "$TEST_TEMP_DIR/test-config.yml"

    run bash -c './install.sh --config-file "$TEST_TEMP_DIR/test-config.yml"'
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Invalid configuration file" ]]
}

@test "install script creates systemd service files" {
    run ./install.sh --dry-run --install-dir "$TEST_TEMP_DIR/systemd-test"
    [ "$status" -eq 0 ]
    [[ "$output" =~ "systemd" ]]
    [[ "$output" =~ "cloud-sync.service" ]]
}

@test "install script sets up log rotation" {
    run ./install.sh --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" =~ "logrotate" ]]
    [[ "$output" =~ "cloud-sync" ]]
}

@test "install script validates cloud provider credentials" {
    # Test with mock AWS credentials
    export AWS_ACCESS_KEY_ID="test-key"
    export AWS_SECRET_ACCESS_KEY="test-secret"
    export AWS_DEFAULT_REGION="us-east-1"

    run ./install.sh --cloud-provider aws --validate-credentials --dry-run
    [[ "$output" =~ "Validating AWS credentials" ]]
}

@test "install script handles verbose output" {
    run ./install.sh --verbose --dry-run
    [ "$status" -eq 0 ]
    # Verbose mode should show more detailed output
    [ ${#output} -gt 1000 ]
}

@test "install script creates backup before upgrade" {
    # Create mock existing installation
    mkdir -p "$TEST_TEMP_DIR/existing-backup-test"
    touch "$TEST_TEMP_DIR/existing-backup-test/cloud-sync"

    run ./install.sh --install-dir "$TEST_TEMP_DIR/existing-backup-test" --backup --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Creating backup" ]]
    [[ "$output" =~ "backup-" ]]
}

@test "install script validates network connectivity" {
    # Mock network failure
    run bash -c 'function curl() { return 1; }; export -f curl; ./install.sh --check-network --dry-run'
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Network connectivity check failed" ]]
}

@test "install script supports different installation profiles" {
    # Test minimal profile
    run ./install.sh --profile minimal --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Minimal installation profile" ]]

    # Test full profile
    run ./install.sh --profile full --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Full installation profile" ]]
}

@test "install script handles rollback on failure" {
    # Simulate installation failure
    run bash -c '
        function cp() {
            if [[ "$3" == *"systemd"* ]]; then
                echo "Mock systemd copy failure" >&2
                return 1
            fi
            command cp "$@"
        }
        export -f cp
        ./install.sh --dry-run
    '
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Installation failed" ]]
    [[ "$output" =~ "Rolling back changes" ]]
}