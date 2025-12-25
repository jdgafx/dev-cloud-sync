import { FileWatcher } from './file-watcher';
import { GoogleDriveSync } from './google-drive-sync';
import { SyncConfig } from './types';
import { defaultConfig } from './config';

export class SyncEngine {
    private watcher: FileWatcher;
    private driveSync: GoogleDriveSync;

    constructor(config: SyncConfig = defaultConfig) {
        this.watcher = new FileWatcher(config);
        this.driveSync = new GoogleDriveSync();
    }

    async start(): Promise<void> {
        console.log('Starting Sync Engine...');
        this.watcher.start();
        await this.driveSync.connect();
    }
}
