import { SyncConfig } from './types';

export const defaultConfig: SyncConfig = {
    rootPath: './sync',
    ignoredPatterns: ['node_modules', '.git'],
};
