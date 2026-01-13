import { EventEmitter } from 'events';
import { SyncConfig } from './types';
import logger from './utils/logger';

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
