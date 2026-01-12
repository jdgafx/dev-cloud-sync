# Rclone Web UI Integration

## Implementation Details
- **Repository**: Cloned `rclone-webui-react` into `apps/rclone-webui`
- **Setup**: Automated via `setup.sh` and `scripts/start-webui.sh`
- **Build Fixes**:
  - Used `--legacy-peer-deps` for `react@16` compatibility
  - Added `SKIP_PREFLIGHT_CHECK=true` to bypass CRA nesting issues
  - Added `NODE_OPTIONS=--openssl-legacy-provider` for Node 18+ SSL compatibility
- **Features**:
  - Real-time Bandwidth Monitor (`src/views/BandwidthMonitor`)
  - Integrated into `DefaultLayout`
  - High-contrast Neon Green on Black design
- **Usage**: `npm run ui`

## Key Files
- `setup.sh`: Master setup script
- `scripts/start-webui.sh`: Launcher
- `apps/rclone-webui/src/views/BandwidthMonitor/BandwidthMonitor.js`: New component
