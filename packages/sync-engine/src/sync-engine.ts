import { FileWatcher } from './file-watcher';
import { GoogleDriveSync } from './google-drive-sync';
import { SyncConfig } from './types';
import { defaultConfig } from './config';
import logger from '@dev-cloud-sync/api-server/utils/logger';

export class SyncEngine {
  private watcher: FileWatcher;
  private driveSync: GoogleDriveSync;

  constructor(config: SyncConfig = defaultConfig) {
    this.watcher = new FileWatcher(config);
    this.driveSync = new GoogleDriveSync();
  }

  async start(): Promise<void> {
    logger.info('Starting Sync Engine...');
    this.watcher.start();
    await this.driveSync.connect();
  }
}
