import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import config from '../config';
import logger from '../utils/logger';

const execAsync = promisify(exec);

export interface TransferItem {
    name: string;
    size: number;
    bytes: number;
    percentage: number;
    speed: number;
    speedAvg: number;
    eta: number;
}

export interface SyncJob {
    id: string;
    name: string;
    source: string;
    destination: string;
    intervalMinutes: number;
    lastRun?: Date;
    nextRun?: Date;
    status: 'idle' | 'running' | 'error' | 'success';
    lastError?: string | null;
    progress?: number;
    bytesTransferred?: number;
    filesTransferred?: number;
    totalBytes?: number;
    totalFiles?: number;
    speed?: number;
    eta?: string;
    startedAt?: Date;
    currentFile?: string;
    currentFileSize?: number;
    currentFileBytes?: number;
    transferring?: TransferItem[]; // Added for per-thread tracking
    diffStatus?: 'synced' | 'different' | 'checking';
    lastDiffCheck?: Date;
    pendingChanges?: number;
    analytics?: {
        successCount: number;
        errorCount: number;
        avgSpeed: number;
        totalBytes: number;
    } | undefined;
    lastSpeed?: number;
    // Internal tracking for instantaneous speed
    _lastCheckTime?: number;
    _lastBytes?: number;
}

export interface RcloneRemote {
    name: string;
    type: string;
}

export interface SyncStats {
    speed: number;
    bytes: number;
    transfers: number;
    checks: number;
    elapsedTime: number;
    activeJobs: number;
}

export interface ActivityLogEntry {
    id: string;
    timestamp: Date;
    type: 'info' | 'warning' | 'error' | 'success' | 'progress';
    jobId: string;
    jobName: string;
    message: string;
    details?: {
        progress?: number | undefined;
        speed?: number | undefined;
        bytesTransferred?: number | undefined;
        filesTransferred?: number | undefined;
        eta?: string | undefined;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        totalBytes?: number | undefined;
    } | undefined;
}

/**
 * RcloneService - Business logic layer for managing sync jobs and rclone operations.
 * Extends EventEmitter to broadcast real-time updates via WebSockets.
 */
export class RcloneService extends EventEmitter {
    private jobs: SyncJob[] = [];
    private configPath: string;
    private activeProcesses: Map<string, ChildProcess> = new Map();
    private stderrBuffers: Map<string, string> = new Map();
    private schedulerInterval: NodeJS.Timeout | null = null;
    private activityLog: ActivityLogEntry[] = [];
    private maxLogEntries = 1000;
    private analytics: Record<string, { successCount: number; errorCount: number; totalBytes: number; avgSpeed: number }> = {};

    constructor() {
        super();
        this.configPath = config.paths.jobsFile;
        this.loadJobs();
        this.loadActivityLog();
        this.loadAnalytics();

        // Start subsystems
        this.startNetworkMonitor();
        this.startScheduler();

        // Trigger initial check/sync for all jobs on startup
        this.triggerStartupSync();
    }

    // === NETWORK RESILIENCE ===
    private isOnline: boolean = true;
    private networkCheckInterval: NodeJS.Timeout | null = null;

    private startNetworkMonitor() {
        // Initial check
        this.checkConnectivity();

        // Periodic check (every 30s)
        this.networkCheckInterval = setInterval(() => this.checkConnectivity(), 30000);
    }

    private async checkConnectivity() {
        try {
            // Lightweight check against reliable DNS
            await require('dns').promises.resolve('google.com');

            if (!this.isOnline) {
                this.isOnline = true;
                logger.info('Network connectivity restored. Resuming operations.');
                this.addLogEntry('success', 'system', 'Network Monitor', 'Internet connectivity restored. Resuming sync operations.');

                // RECOVERY: Retry failed jobs immediately
                for (const job of this.jobs) {
                    if (job.status === 'error') {
                        logger.info('Retrying job after network recovery', { jobId: job.id });
                        job.status = 'idle';
                        // We don't force execute here, the scheduler or startupSync will pick it up
                        // or we can force it:
                    }
                }
                this.emit('jobs:update', this.jobs);
                this.triggerStartupSync();
            }
        } catch (e) {
            if (this.isOnline) {
                this.isOnline = false;
                logger.warn('Network connectivity lost. Pausing operations.');
                this.addLogEntry('warning', 'system', 'Network Monitor', 'Internet connectivity lost. Pausing sync operations to prevent errors.');
            }
        }
    }

    private async triggerStartupSync(): Promise<void> {
        logger.info('System startup: Triggering immediate check/sync for all missions...');
        for (const job of this.jobs) {
            this.executeJob(job);
        }
    }

    async checkDiff(id: string): Promise<boolean> {
        const job = this.jobs.find(j => j.id === id);
        if (!job || job.status === 'running' || job.diffStatus === 'checking') return false;

        job.diffStatus = 'checking';
        this.emit('jobs:update', this.jobs);

        try {
            // Use rclone check --one-way to find if source has things destination doesn't
            // We use --quiet and check exit code. 
            // 0 = match, 1 = diff, other = error
            const args = [
                'check',
                job.source,
                job.destination,
                '--one-way',
                '--quiet'
            ];

            logger.info('Performing diff check...', { jobId: job.id, name: job.name });

            const process = spawn('rclone', args);

            return new Promise((resolve) => {
                process.on('close', (code) => {
                    job.lastDiffCheck = new Date();
                    if (code === 0) {
                        job.diffStatus = 'synced';
                        job.pendingChanges = 0;
                        logger.info('Check complete: Node is in perfect sync.', { jobId: job.id });
                        resolve(false);
                    } else if (code === 1) {
                        job.diffStatus = 'different';
                        job.pendingChanges = 1; // Placeholder for "some changes"
                        logger.info('Check complete: Differences detected. Sync required.', { jobId: job.id });
                        resolve(true);
                    } else {
                        job.diffStatus = 'error' as any;
                        logger.error('Diff check failed', { jobId: job.id, code });
                        resolve(false);
                    }
                    this.emit('jobs:update', this.jobs);
                });
            });
        } catch (e) {
            job.diffStatus = 'error' as any;
            this.emit('jobs:update', this.jobs);
            return false;
        }
    }

    private async loadAnalytics(): Promise<void> {
        try {
            const analyticalFile = path.join(config.paths.data, 'analytics.json');
            if (fs.existsSync(analyticalFile)) {
                this.analytics = JSON.parse(fs.readFileSync(analyticalFile, 'utf-8'));
            }
        } catch (e) {
            logger.error('Failed to load analytics', { error: (e as Error).message });
        }
    }

    private async saveAnalytics(): Promise<void> {
        try {
            const analyticalFile = path.join(config.paths.data, 'analytics.json');
            fs.writeFileSync(analyticalFile, JSON.stringify(this.analytics, null, 2));
        } catch (e) {
            logger.error('Failed to save analytics', { error: (e as Error).message });
        }
    }

    private updateAnalytics(jobId: string, status: 'success' | 'error', bytes: number, speed: number) {
        if (!this.analytics[jobId]) {
            this.analytics[jobId] = { successCount: 0, errorCount: 0, totalBytes: 0, avgSpeed: 0 };
        }
        const stats = this.analytics[jobId];
        if (status === 'success') {
            stats.successCount++;
            stats.totalBytes += bytes;
            // Moving average for speed
            stats.avgSpeed = stats.avgSpeed === 0 ? speed : (stats.avgSpeed * 0.7 + speed * 0.3);
        } else {
            stats.errorCount++;
        }
        this.saveAnalytics();
    }

    // === ACTIVITY LOG ===

    private addLogEntry(
        type: ActivityLogEntry['type'],
        jobId: string,
        jobName: string,
        message: string,
        details?: ActivityLogEntry['details']
    ): ActivityLogEntry {
        const entry: ActivityLogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            type,
            jobId,
            jobName,
            message,
            details,
        };

        this.activityLog.push(entry);

        // Keep log size bounded
        if (this.activityLog.length > this.maxLogEntries) {
            this.activityLog = this.activityLog.slice(this.activityLog.length - this.maxLogEntries);
        }

        // Emit to WebSocket clients
        this.emit('activity:log', entry);

        // Save log
        this.saveActivityLog();
        return entry;
    }

    getActivityLog(limit = 100): ActivityLogEntry[] {
        // Return the last 'limit' entries (newest)
        return this.activityLog.slice(-limit);
    }

    clearActivityLog(): void {
        this.activityLog = [];
        this.emit('activity:cleared');
    }

    // === LIFECYCLE ===

    private startScheduler(): void {
        this.schedulerInterval = setInterval(
            () => this.runScheduler(),
            config.rclone.schedulerIntervalMs
        );
        logger.info('RcloneService initialized with scheduler', {
            intervalMs: config.rclone.schedulerIntervalMs,
        });

        // Calculate next run times for all jobs
        this.updateNextRunTimes();
    }

    private updateNextRunTimes(): void {
        const now = new Date();
        for (const job of this.jobs) {
            const lastRun = job.lastRun ? new Date(job.lastRun) : new Date(0);
            job.nextRun = new Date(lastRun.getTime() + job.intervalMinutes * 60000);
        }
        this.saveJobs();
    }

    public async shutdown(): Promise<void> {
        logger.info('RcloneService shutting down...');

        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }

        const stopPromises = Array.from(this.activeProcesses.keys()).map((id) => {
            return new Promise<void>((resolve) => {
                this.stopJob(id);
                resolve();
            });
        });

        await Promise.all(stopPromises);
        logger.info('RcloneService shutdown complete');
    }

    // === PERSISTENCE ===

    private loadJobs(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
                this.jobs = data.map((j: any) => ({
                    ...j,
                    status: j.status === 'running' ? 'idle' : j.status,
                }));
                logger.info(`Loaded ${this.jobs.length} jobs from disk`);
            }
        } catch (e) {
            logger.error('Failed to load jobs', { error: (e as Error).message });
        }
    }

    private saveJobs(): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.jobs, null, 2));
        } catch (e) {
            logger.error('Failed to save jobs', { error: (e as Error).message });
        }
    }

    // === JOB MANAGEMENT ===

    getJobs(): SyncJob[] {
        return this.jobs.map(job => ({
            ...job,
            analytics: this.analytics[job.id]
        }));
    }

    getJob(id: string): SyncJob | undefined {
        const job = this.jobs.find((j) => j.id === id);
        if (!job) return undefined;
        return {
            ...job,
            analytics: this.analytics[job.id]
        };
    }

    addJob(job: Partial<SyncJob>): SyncJob {
        const newJob: SyncJob = {
            id: job.id || Date.now().toString(),
            name: job.name || 'Unnamed Job',
            source: job.source || '',
            destination: job.destination || '',
            intervalMinutes: job.intervalMinutes || 60,
            status: 'idle',
            progress: 0,
            nextRun: new Date(Date.now() + (job.intervalMinutes || 60) * 60000),
        };
        this.jobs.push(newJob);
        this.saveJobs();
        logger.info('Added job', { jobId: newJob.id, name: newJob.name });

        this.addLogEntry('info', newJob.id, newJob.name, `Job "${newJob.name}" created`);
        this.emit('jobs:update', this.jobs);

        return newJob;
    }

    updateJob(id: string, updates: Partial<SyncJob>): SyncJob | null {
        const job = this.jobs.find((j) => j.id === id);
        if (!job) return null;

        Object.assign(job, updates);
        this.saveJobs();
        logger.info('Updated job', { jobId: id });

        this.addLogEntry('info', job.id, job.name, `Job "${job.name}" updated`);
        this.emit('jobs:update', this.jobs);

        return job;
    }

    removeJob(id: string): boolean {
        const idx = this.jobs.findIndex((j) => j.id === id);
        if (idx === -1) return false;

        const job = this.jobs[idx];
        if (!job) return false;

        const jobName = job.name;
        this.stopJob(id);
        this.jobs.splice(idx, 1);
        this.saveJobs();
        logger.info('Removed job', { jobId: id });

        this.addLogEntry('info', id, jobName, `Job "${jobName}" deleted`);
        this.emit('jobs:update', this.jobs);

        return true;
    }

    // === SYNC EXECUTION ===

    async runJobNow(id: string): Promise<boolean> {
        const job = this.jobs.find((j) => j.id === id);
        if (!job) return false;

        if (job.status === 'running') {
            logger.warn('Job already running', { jobId: id });
            return false;
        }

        this.executeJob(job);
        return true;
    }

    stopJob(id: string): boolean {
        const process = this.activeProcesses.get(id);
        if (process) {
            process.kill('SIGTERM');
            this.activeProcesses.delete(id);

            const job = this.jobs.find((j) => j.id === id);
            if (job) {
                job.status = 'idle';
                job.progress = 0;
                job.speed = 0;
                this.saveJobs();

                this.addLogEntry('warning', id, job.name, `Job "${job.name}" stopped by user`);
                this.emit('jobs:update', this.jobs);
            }
            logger.info('Stopped job', { jobId: id });
            return true;
        }
        return false;
    }

    private async executeJob(job: SyncJob): Promise<void> {
        logger.info('Starting job', { jobId: job.id, name: job.name });

        // Update job state
        job.status = 'running';
        job.progress = 0;
        job.lastError = null;
        job.bytesTransferred = 0;
        job.filesTransferred = 0;
        job.speed = 0;
        job.startedAt = new Date();
        this.saveJobs();

        this.addLogEntry('info', job.id, job.name, `Starting sync: ${job.source} → ${job.destination}`);
        this.emit('jobs:update', this.jobs);

        try {
            // Validate paths
            if (!job.source || !job.destination) {
                throw new Error('Source and destination are required');
            }

            // Check if source exists (for local paths)
            if (!job.source.includes(':') && !fs.existsSync(job.source)) {
                throw new Error(`Source path does not exist: ${job.source}`);
            }

            // Create destination if it's a remote
            if (job.destination.includes(':')) {
                try {
                    await execAsync(`rclone mkdir "${job.destination}" --timeout ${config.rclone.timeout}s`);
                } catch (e: any) {
                    if (e.message.includes("didn't find section")) {
                        const remoteName = job.destination.split(':')[0];
                        throw new Error(`Remote "${remoteName}" is not configured. Run: rclone config`);
                    }
                }
            }

            // Run sync with ULTRA PERFORMANCE flags
            const args = [
                'sync',
                job.source,
                job.destination,
                '--exclude', '.wrangler/**',
                '--exclude', '**/node_modules/**',
                '--exclude', '**/.git/**',
                '--exclude', '**/*.tmp',
                '--stats', '1s',
                '--use-json-log',
                '--stats-log-level', 'info',
                '--fast-list',
                '--transfers', '32',
                '--checkers', '64',
                '--buffer-size', '256M',
                '--multi-thread-streams', '16',
                '--multi-thread-cutoff', '64M',
                '--use-mmap',
                '--drive-chunk-size', '128M',
                '--s3-upload-concurrency', '16',
                '--max-backlog', '1000000',
                '--ignore-errors',
                '--user-agent', 'dev-cloud-sync-ultra-speed',
                '--copy-links',
                '--metadata',
                '-v'
            ];

            const process = spawn('rclone', args);
            this.activeProcesses.set(job.id, process);

            let lastProgressUpdate = 0;
            const emitUpdate = () => {
                const now = Date.now();
                if (now - lastProgressUpdate > 200) {
                    lastProgressUpdate = now;
                    this.emit('jobs:update', this.jobs);
                    // Construct detailed message
                    let msg = 'Syncing...';
                    if (job.currentFile) {
                        msg = `Syncing: ${job.currentFile}`;
                    } else if ((job.filesTransferred || 0) > 0) {
                        msg = `Transferred ${job.filesTransferred} files...`;
                    }

                    this.addLogEntry('progress', job.id, job.name, msg, {
                        progress: job.progress,
                        speed: job.speed,
                        bytesTransferred: job.bytesTransferred,
                        filesTransferred: job.filesTransferred,
                        eta: job.eta,
                        fileName: job.currentFile,
                        fileSize: job.currentFileSize,
                        totalBytes: job.totalBytes
                    });
                }
            };

            this.stderrBuffers.set(job.id, '');

            process.stderr?.on('data', (data) => {
                const chunk = data.toString();
                let buffer = this.stderrBuffers.get(job.id) || '';
                buffer += chunk;

                // Split by newline, handle lines
                const lines = buffer.split('\n');

                // The last item is either an empty string (if ended with \n) or an incomplete line
                // We keep it in the buffer for the next chunk
                const remaining = lines.pop() || '';
                this.stderrBuffers.set(job.id, remaining);

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const parsed = JSON.parse(line);

                        // Pass to stats parser (isJson = true)
                        this.parseRcloneOutput(job, line, true);
                        if (parsed.stats) emitUpdate();

                        if (parsed.level === 'error') {
                            this.addLogEntry('error', job.id, job.name, parsed.msg || 'Unknown error');
                        } else if (parsed.level === 'info' || parsed.level === 'notice') {
                            // Parse transfer messages
                            // "Transferred: ..." messages are often stats, we rely on parsed.stats object usually
                            // But normal info logs like "Copied (new)" are useful
                            if (parsed.msg && !parsed.msg.includes('Transferred:')) {
                                this.addLogEntry('info', job.id, job.name, parsed.msg);
                            }
                        }
                    } catch (e) {
                        // Not JSON?
                        // With --use-json-log, almost everything should be JSON. 
                        // But sometimes rclone prints raw errors or system messages.
                        if (line.includes('ERROR')) {
                            // logger.error('Error in job', { jobId: job.id, line });
                            this.addLogEntry('error', job.id, job.name, line.trim());
                        }
                    }
                }
            });

            await new Promise<void>((resolve, reject) => {
                process.on('close', (code, signal) => {
                    this.activeProcesses.delete(job.id);
                    this.stderrBuffers.delete(job.id);

                    // Check if job was manually stopped (SIGTERM or status set to 'idle')
                    const currentJob = this.jobs.find(j => j.id === job.id);
                    if (signal === 'SIGTERM' || currentJob?.status === 'idle') {
                        resolve();
                        return;
                    }

                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`rclone exited with code ${code}`));
                    }
                });

                process.on('error', (err) => {
                    this.activeProcesses.delete(job.id);
                    this.stderrBuffers.delete(job.id);
                    reject(err);
                });
            });

            job.lastRun = new Date();
            job.nextRun = new Date(Date.now() + job.intervalMinutes * 60000);
            job.status = 'success';
            job.progress = 100;
            job.lastError = null;
            job.speed = 0;

            const duration = job.startedAt
                ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)
                : 0;

            logger.info('Completed job', { jobId: job.id, name: job.name });
            this.addLogEntry(
                'success',
                job.id,
                job.name,
                `Sync completed in ${this.formatDuration(duration)}. Transferred ${this.formatBytes(job.bytesTransferred || 0)}`
            );

            // POST-EXECUTION HOOK (Memory Pattern)
            this.updateAnalytics(job.id, 'success', job.bytesTransferred || 0, job.speed || 0);

        } catch (error: any) {
            logger.error('Job failed', { jobId: job.id, error: error.message });
            job.status = 'error';
            job.lastError = error.message;
            job.speed = 0;

            this.addLogEntry('error', job.id, job.name, `Sync failed: ${error.message}`);

            // HOOK: Log failure for analytics
            this.updateAnalytics(job.id, 'error', 0, 0);
        }

        this.saveJobs();
        this.emit('jobs:update', this.jobs);
    }

    private parseRcloneOutput(job: SyncJob, line: string, isJson: boolean = false): void {
        if (!isJson) return; // We only support JSON mode now

        try {
            const logEntry = JSON.parse(line);

            // Handle stats
            if (logEntry.stats) {
                job.status = 'running';

                // Rclone stats structure:
                // {
                //   bytes: 0,
                //   checks: 0,
                //   deletedDirs: 0,
                //   deletes: 0,
                //   elapsedTime: 0.500350711,
                //   errors: 0,
                //   eta: null,
                //   fatalError: false,
                //   renames: 0,
                //   retryError: false,
                //   speed: 0, // Bytes per second
                //   totalBytes: 0,
                //   totalChecks: 0,
                //   totalTransfers: 0,
                //   transferring: [],
                //   transfers: 0
                // }

                // SPEED & BANDWIDTH LOGIC
                // Rclone's reported speed is often an average. We want instantaneous for the "Live Bandwidth" feel.
                const now = Date.now();
                const currentBytes = logEntry.stats.bytes || 0;

                if (!job._lastCheckTime) {
                    job._lastCheckTime = now;
                    job._lastBytes = currentBytes;
                    job.speed = 0;
                } else {
                    const timeDiffSec = (now - job._lastCheckTime) / 1000;
                    let bytesDiff = currentBytes - (job._lastBytes || 0);

                    // Guard against rclone counter resets
                    if (bytesDiff < 0) bytesDiff = 0;

                    // 2-second window for stability
                    if (timeDiffSec >= 2) {
                        const calculatedSpeed = bytesDiff / timeDiffSec;

                        // Sanity Cap: 125 MB/s (1 Gbps)
                        const MAX_SPEED = 125 * 1024 * 1024;
                        let cappedSpeed = calculatedSpeed > MAX_SPEED ? MAX_SPEED : calculatedSpeed;

                        // Smooth transition (0.4 weight on new data)
                        const prevSpeed = job.speed || 0;
                        job.speed = (prevSpeed * 0.6) + (cappedSpeed * 0.4);

                        // Reset tracking for next interval
                        job._lastCheckTime = now;
                        job._lastBytes = currentBytes;

                        // Clean up small values
                        if (job.speed < 1024) job.speed = 0;
                    }
                }

                if (job.speed !== undefined) {
                    job.lastSpeed = job.speed;
                }

                if (logEntry.stats.bytes !== undefined) job.bytesTransferred = logEntry.stats.bytes;
                if (logEntry.stats.totalBytes !== undefined) job.totalBytes = logEntry.stats.totalBytes;
                if (logEntry.stats.transfers !== undefined) job.filesTransferred = logEntry.stats.transfers;
                if (logEntry.stats.totalTransfers !== undefined) job.totalFiles = logEntry.stats.totalTransfers;

                // Progress
                if (job.totalBytes && job.totalBytes > 0) {
                    job.progress = Math.round((job.bytesTransferred! / job.totalBytes) * 100);
                } else if (job.totalFiles && job.totalFiles > 0) {
                    job.progress = Math.round((job.filesTransferred! / job.totalFiles) * 100);
                } else {
                    job.progress = 0;
                }

                // ETA
                if (logEntry.stats.eta !== null && logEntry.stats.eta !== undefined && logEntry.stats.eta > 0) {
                    job.eta = this.formatDuration(Math.round(logEntry.stats.eta));
                } else if (job.speed && job.speed > 0 && job.totalBytes) {
                    const remainingBytes = job.totalBytes - (job.bytesTransferred || 0);
                    if (remainingBytes > 0) {
                        job.eta = this.formatDuration(Math.round(remainingBytes / job.speed));
                    }
                }

                // PER-THREAD TRACKING (The "Sync Threads" Fix)
                if (logEntry.stats.transferring && logEntry.stats.transferring.length > 0) {
                    job.transferring = logEntry.stats.transferring.map((t: any) => ({
                        name: t.name,
                        size: t.size,
                        bytes: t.bytes,
                        percentage: t.percentage,
                        speed: t.speed,
                        speedAvg: t.speedAvg,
                        eta: t.eta
                    }));

                    // Still keep currentFile for basic UI
                    const firstTransfer = logEntry.stats.transferring[0];
                    job.currentFile = firstTransfer.name;
                    job.currentFileSize = firstTransfer.size;
                    job.currentFileBytes = firstTransfer.bytes;
                } else {
                    job.transferring = [];
                    delete job.currentFile;
                    delete job.currentFileSize;
                    delete job.currentFileBytes;
                }
            }
        } catch (e: any) {
            // logger.debug('Failed to parse rclone JSON output', { error: e.message });
        }
    }

    private formatDuration(seconds: number): string {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins < 60) return `${mins}m ${secs}s`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ${mins % 60}m`;
    }

    private formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
        return `${(bytes / 1073741824).toFixed(2)} GB`;
    }

    private async runScheduler(): Promise<void> {
        // ULTRATHINK: if offline, skip critical operations to prevent "error"spam
        if (!this.isOnline) {
            return;
        }

        const now = new Date();

        for (const job of this.jobs) {
            if (job.status === 'running' || job.diffStatus === 'checking') continue;

            const lastDiffCheck = job.lastDiffCheck ? new Date(job.lastDiffCheck) : new Date(0);

            // Check diff every cycle (roughly 60s based on config)
            const diffFound = await this.checkDiff(job.id);

            if (diffFound) {
                this.addLogEntry('info', job.id, job.name, `Auto-backup triggered: detected ${job.pendingChanges} mission-critical differences.`);
                this.executeJob(job);
            } else {
                // Even if no diff found, we might want to run based on intervalMinutes 
                // for absolute certainty or cleanup tasks
                const lastRun = job.lastRun ? new Date(job.lastRun) : new Date(0);
                const nextRun = new Date(lastRun.getTime() + job.intervalMinutes * 60000);

                if (now >= nextRun) {
                    this.addLogEntry('info', job.id, job.name, `Recurring sync cycle reached. Verifying integrity...`);
                    this.executeJob(job);
                }
            }
        }
    }

    // === RCLONE MANAGEMENT ===

    async getRemotes(): Promise<RcloneRemote[]> {
        try {
            const { stdout } = await execAsync('rclone listremotes --long');
            const lines = stdout.trim().split('\n').filter((l) => l);
            return lines
                .map((line) => {
                    const parts = line.split(':');
                    const name = parts[0];
                    if (!name) return null;
                    return {
                        name,
                        type: parts[1]?.trim() || 'unknown',
                    };
                })
                .filter((r): r is RcloneRemote => r !== null);
        } catch (e) {
            logger.error('Failed to list remotes', { error: (e as Error).message });
            return [];
        }
    }

    async getStats(): Promise<SyncStats> {
        const runningJobs = this.jobs.filter((j) => j.status === 'running');

        return {
            speed: runningJobs.reduce((sum, j) => sum + (j.speed || 0), 0),
            bytes: runningJobs.reduce((sum, j) => sum + (j.bytesTransferred || 0), 0),
            transfers: runningJobs.reduce((sum, j) => sum + (j.filesTransferred || 0), 0),
            checks: 0,
            elapsedTime: 0,
            activeJobs: runningJobs.length,
        };
    }

    async testConnection(remote: string): Promise<{ success: boolean; message: string }> {
        try {
            await execAsync(`rclone lsd "${remote}" --max-depth 0 --timeout 15s`);
            return { success: true, message: 'Connection successful' };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async getDirectoryListing(path: string): Promise<string[]> {
        try {
            const { stdout } = await execAsync(`rclone lsd "${path}" --timeout ${config.rclone.timeout}s`);
            return stdout
                .trim()
                .split('\n')
                .filter((l) => l)
                .map((l) => l.split(/\s+/).pop() || '');
        } catch (e) {
            return [];
        }
    }

    async listRemotePath(remoteName: string | null | undefined, remotePath: string = ''): Promise<any[]> {
        try {
            let fullPath = '';

            if (!remoteName) {
                // Local filesystem - default to / or use absolute path
                fullPath = remotePath || '/';
            } else {
                fullPath = remoteName;
                if (!fullPath.includes(':') && !fullPath.startsWith('/')) {
                    fullPath += ':';
                }
                if (remotePath) {
                    const cleanRemotePath = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath;
                    fullPath = `${fullPath}${cleanRemotePath}`;
                }
            }

            logger.debug('Listing path...', { fullPath });
            const { stdout, stderr } = await execAsync(`rclone lsjson "${fullPath}" --timeout ${config.rclone.timeout}s`);

            if (stderr && stderr.includes('ERROR')) {
                logger.warn('rclone lsjson reported errors', { stderr, path: fullPath });
            }

            return JSON.parse(stdout);
        } catch (e: any) {
            logger.error('Failed to list remote path', {
                error: e.message,
                remote: remoteName,
                path: remotePath
            });
            throw new Error(`Listing failed: ${e.message}`);
        }
    }
    private loadActivityLog(): void {
        try {
            const logFile = path.join(config.paths.data, 'activity.json');
            if (fs.existsSync(logFile)) {
                const data = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
                // Ensure dates are Date objects
                this.activityLog = data.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }));

                // Sort Oldest -> Newest (Ascending)
                this.activityLog.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                // Limit to last 500 entries (tail)
                if (this.activityLog.length > 500) {
                    this.activityLog = this.activityLog.slice(-500);
                }
            }
        } catch (error) {
            logger.error('Failed to load activity log', { error: (error as Error).message });
        }
    }

    private saveActivityLog(): void {
        try {
            const logFile = path.join(config.paths.data, 'activity.json');
            // Ensure data directory exists
            const dir = path.dirname(logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(logFile, JSON.stringify(this.activityLog, null, 2));
        } catch (error) {
            logger.error('Failed to save activity log', { error: (error as Error).message });
        }
    }
}
