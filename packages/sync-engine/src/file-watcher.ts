import { EventEmitter } from 'events';
import { SyncConfig, FileChange } from './types';
import logger from '@dev-cloud-sync/api-server/utils/logger';

export class FileWatcher extends EventEmitter {
  constructor(private config: SyncConfig) {
    super();
  }

  start(): void {
    logger.info('File watcher started');
  }

  stop(): void {
    logger.info('File watcher stopped');
  }
}
