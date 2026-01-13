# Plan: rclone-webui Functional Enhancements

## 1. Delete Config Refactor
- **File**: `apps/rclone-webui/src/views/RemoteManagement/ShowConfig/ConfigRow.js`
- **Tasks**:
    - Replace `window.confirm` with `reactstrap` Modal.
    - Connect Modal "Confirm" to existing `onDeleteClicked` logic.
    - Remove `// TODO: Delete config functionality`.

## 2. NewDrive Logic Completion
- **File**: `apps/rclone-webui/src/views/RemoteManagement/NewDrive/NewDrive.js`
- **Tasks**:
    - Update `DriveParameters` for `SizeSuffix` and `Duration` types.
    - Update `handleSubmit` to handle `auth` URLs in the `config/create` response.
    - Enhance validation feedback in `FormFeedback`.
