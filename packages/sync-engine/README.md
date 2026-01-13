# @dev-cloud-sync/sync-engine

The core file synchronization logic for the dev-cloud-sync platform.

## Description

The `sync-engine` package handles the complex task of keeping local directories in sync with Google Drive. It leverages `rclone` for robust data transfer and the Google Drive API for fine-grained file management and event tracking.

## Key Features

- **File System Watching**: Real-time monitoring of local file changes using `chokidar`.
- **Rclone Integration**: Uses `rclone` for efficient, high-performance file synchronization.
- **Google Drive API**: Direct integration with the Google Drive API for advanced file metadata and authorization.
- **Event-Driven Architecture**: Uses RxJS to manage and respond to file system events and sync status updates.
- **Queue Management**: Intelligent queuing of sync tasks to prevent resource exhaustion.
- **Conflict Resolution**: Logic to handle differences between local and remote file states.

## Directory Structure

```text
src/
├── sync-engine.ts       # Main coordinator for watching and syncing
├── file-watcher.ts      # Logic for monitoring local file system changes
├── rclone-sync.ts       # Rclone command execution and parsing
├── google-drive-sync.ts # Direct Google Drive API interaction
├── config.ts            # Engine-specific configuration defaults
├── types.ts             # Internal types for the sync engine
└── utils/               # Internal utility functions (logger, etc.)
```

## Installation & Usage

### Prerequisites

- `rclone` must be installed on the host system.
- Google Drive API credentials must be configured.

### Installation

```bash
npm install @dev-cloud-sync/sync-engine
```

### Usage

```typescript
import { SyncEngine } from '@dev-cloud-sync/sync-engine';

const engine = new SyncEngine({
  localPath: './my-data',
  remotePath: 'gdrive:backup',
});

await engine.start();
console.log('Sync engine is running...');
```

## Scripts

- `npm run build`: Compile TypeScript to JavaScript.
- `npm run dev`: Start the engine in development mode with watch.
- `npm run test`: Run the test suite.
- `npm run lint`: Lint the codebase.
