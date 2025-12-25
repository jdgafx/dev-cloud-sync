import { EventEmitter } from 'events';
import { SyncConfig, FileChange } from './types';

export class FileWatcher extends EventEmitter {
    constructor(private config: SyncConfig) {
        super();
    }

    start(): void {
        console.log('File watcher started');
    }

    stop(): void {
        console.log('File watcher stopped');
    }
}
