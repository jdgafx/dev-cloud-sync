export interface SyncConfig {
    rootPath: string;
    ignoredPatterns: string[];
}

export interface FileChange {
    path: string;
    type: 'add' | 'modify' | 'delete';
    timestamp: number;
}
