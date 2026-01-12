
export interface Job {
    id: string;
    name: string;
    source: string;
    destination: string;
    intervalMinutes: number;
    lastRun?: string;
    nextRun?: string;
    status: 'idle' | 'running' | 'error' | 'success';
    lastError?: string;
    progress?: number;
    bytesTransferred?: number;
    filesTransferred?: number;
    speed?: number;
    eta?: string;
}

export const API_URL = 'http://localhost:8888/api/v1';
export const WS_URL = 'http://localhost:8888';
