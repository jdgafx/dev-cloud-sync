import { FileWatcher } from './file-watcher';
import { GoogleDriveSync } from './google-drive-sync';
import { SyncConfig } from './types';
import { defaultConfig } from './config';
import logger from './utils/logger';

/**
 * Core synchronization engine responsible for coordinating file watching
 * and cloud storage synchronization.
 */
export class SyncEngine {
  private watcher: FileWatcher;
  private driveSync: GoogleDriveSync;

  /**
   * Creates an instance of SyncEngine.
   * @param config The synchronization configuration. Defaults to defaultConfig.
   */
  constructor(config: SyncConfig = defaultConfig) {
    this.watcher = new FileWatcher(config);
    this.driveSync = new GoogleDriveSync();
  }

  /**
   * Starts the synchronization engine subsystems.
   * Initializes file watching and establishes connection to Google Drive.
   * @returns A promise that resolves when the engine has started.
   */
  async start(): Promise<void> {
    logger.info('Starting Sync Engine...');
    this.watcher.start();
    await this.driveSync.connect();
  }
}
