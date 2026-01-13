# Plan: Unified Navigation Integration

## 1. Main App Sidebar
- **File**: `apps/web/src/App.tsx`
- **Tasks**:
    - Add "Advanced Explorer" to `Sidebar` nav items.
    - Icon: `HardDrive` or `Settings`.
    - Target: `/explorer` (assuming proxy configuration).

## 2. rclone-webui Header
- **File**: `apps/rclone-webui/src/containers/DefaultLayout/DefaultHeader.js`
- **Tasks**:
    - Add `NavLink` to `/` with label "Main Dashboard".
    - Update Brand logo to link back to main app.

## 3. Styling Alignment
- **File**: `apps/rclone-webui/src/App.scss`
- **Tasks**:
    - Override primary colors to match `apps/web` Cyan (`#06b6d4`) and Slate (`#0f172a`).
