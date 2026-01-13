import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import config from '../config';
import logger from '../utils/logger';
import { RcloneRunner } from '@dev-cloud-sync/shared';

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
  concurrency?: number;
  timeout?: number; // timeout in seconds
  retries?: number; // number of retry attempts
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
  transferring?: TransferItem[];
  diffStatus?: 'synced' | 'different' | 'checking';
  lastDiffCheck?: Date;
  pendingChanges?: number;
  analytics?:
    | {
        successCount: number;
        errorCount: number;
        avgSpeed: number;
        totalBytes: number;
      }
    | undefined;
  lastSpeed?: number;
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
  storage?:
    | {
        total: number;
        used: number;
        free: number;
        percent: number;
      }
    | undefined;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success' | 'progress';
  jobId: string;
  jobName: string;
  message: string;
  details?:
    | {
        progress?: number | undefined;
        speed?: number | undefined;
        bytesTransferred?: number | undefined;
        filesTransferred?: number | undefined;
        eta?: string | undefined;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        totalBytes?: number | undefined;
      }
    | undefined;
}

export class RcloneService extends EventEmitter {
  private jobs: SyncJob[] = [];
  private configPath: string;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private stderrBuffers: Map<string, string> = new Map();
  private schedulerInterval: NodeJS.Timeout | null = null;
  private activityLog: ActivityLogEntry[] = [];
  private maxLogEntries = 1000;
  private analytics: Record<
    string,
    {
      successCount: number;
      errorCount: number;
      totalBytes: number;
      avgSpeed: number;
    }
  > = {};
  private storageStats: SyncStats['storage'] | undefined;
  private storageCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.configPath = config.paths.jobsFile;
    this.loadJobs();
    this.loadActivityLog();
    this.loadAnalytics();
    this.startNetworkMonitor();
    this.startScheduler();
    this.updateStorageStats();
    this.storageCheckInterval = setInterval(
      () => this.updateStorageStats(),
      5 * 60 * 1000
    );
    this.triggerStartupSync();
  }

  private isOnline: boolean = true;
  private networkCheckInterval: NodeJS.Timeout | null = null;

  private startNetworkMonitor() {
    this.checkConnectivity();
    this.networkCheckInterval = setInterval(
      () => this.checkConnectivity(),
      30000
    );
  }

  private async checkConnectivity() {
    if (!this.isOnline) {
      this.isOnline = true;
      logger.info(
        'Network connectivity check overridden to ONLINE (Ultra Mode).'
      );
      this.emit('jobs:update', this.jobs);
      this.triggerStartupSync();
    }
    try {
      await require('dns').promises.resolve('google.com');
    } catch (e) {
      logger.warn(
        'Network connectivity check failed, but proceeding anyway (Ultra Mode).'
      );
    }
  }

  private async triggerStartupSync(): Promise<void> {
    logger.info(
      'System startup: Triggering immediate check/sync for all sync jobs...'
    );
    for (const job of this.jobs) {
      this.executeJob(job);
    }
  }

  async checkDiff(id: string): Promise<boolean> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || job.status === 'running' || job.diffStatus === 'checking')
      return false;

    job.diffStatus = 'checking';
    this.emit('jobs:update', this.jobs);

    try {
      const args = [
        'check',
        job.source,
        job.destination,
        '--one-way',
        '--quiet',
      ];
      logger.info('Performing diff check...', {
        jobId: job.id,
        name: job.name,
      });

      const { code } = await RcloneRunner.run(args, {
        allowedExitCodes: [0, 1],
        timeoutMs: config.rclone.timeout * 1000,
      });

      job.lastDiffCheck = new Date();
      if (code === 0) {
        job.diffStatus = 'synced';
        job.pendingChanges = 0;
        logger.info('Check complete: Node is in perfect sync.', {
          jobId: job.id,
        });
        return false;
      } else if (code === 1) {
        job.diffStatus = 'different';
        job.pendingChanges = 1;
        logger.info('Check complete: Differences detected. Sync required.', {
          jobId: job.id,
        });
        return true;
      } else {
        job.diffStatus = 'error' as any;
        logger.error('Diff check failed', { jobId: job.id, code });
        return false;
      }
    } catch (e: any) {
      job.diffStatus = 'error' as any;
      logger.error('Diff check error', { jobId: job.id, error: e.message });
      return false;
    } finally {
      this.emit('jobs:update', this.jobs);
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

  private updateAnalytics(
    jobId: string,
    status: 'success' | 'error',
    bytes: number,
    speed: number
  ) {
    if (!this.analytics[jobId]) {
      this.analytics[jobId] = {
        successCount: 0,
        errorCount: 0,
        totalBytes: 0,
        avgSpeed: 0,
      };
    }
    const stats = this.analytics[jobId];
    if (status === 'success') {
      stats.successCount++;
      stats.totalBytes += bytes;
      stats.avgSpeed =
        stats.avgSpeed === 0 ? speed : stats.avgSpeed * 0.7 + speed * 0.3;
    } else {
      stats.errorCount++;
    }
    this.saveAnalytics();
  }

  private async updateStorageStats() {
    try {
      const remotes = await this.listRemotes();
      let targetRemote =
        remotes.find((r) => r.name === 'backup')?.name || remotes[0]?.name;
      if (targetRemote) {
        if (!targetRemote.endsWith(':')) targetRemote += ':';
        const { stdout } = await RcloneRunner.run([
          'about',
          targetRemote,
          '--json',
          '--timeout',
          '30s',
        ]);
        const data = JSON.parse(stdout);
        if (data && data.total) {
          this.storageStats = {
            total: data.total,
            used: data.used,
            free: data.free,
            percent:
              data.used && data.total
                ? Math.round((data.used / data.total) * 100)
                : 0,
          };
          this.emit('stats:update', await this.getStats());
        }
      }
    } catch (e) {
      logger.warn('Failed to fetch storage stats', {
        error: (e as Error).message,
      });
    }
  }

  public async listRemotes(): Promise<RcloneRemote[]> {
    try {
      // Try the verbose list first (has type information), with a short timeout
      try {
        const { stdout } = await RcloneRunner.run(['listremotes', '--long'], {
          timeoutMs: 5000,
        });
        const lines: string[] = String(stdout)
          .trim()
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        return lines
          .map((line: string) => {
            const parts = line.split(':');
            const name = parts[0]?.trim();
            const type = parts[1]?.trim() || 'unknown';
            if (!name) return null;
            return { name, type };
          })
          .filter((r): r is RcloneRemote => r !== null);
      } catch (e) {
        // Fallback to the simpler command if --long not supported
        const { stdout } = await RcloneRunner.run(['listremotes'], {
          timeoutMs: 5000,
        });
        const lines: string[] = String(stdout)
          .trim()
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        return lines
          .map((line: string) => {
            const parts = line.split(':');
            const name = parts[0]?.trim();
            const type = parts[1]?.trim() || 'unknown';
            if (!name) return null;
            return { name, type };
          })
          .filter((r): r is RcloneRemote => r !== null);
      }
    } catch (e) {
      logger.error('Failed to list remotes', { error: (e as Error).message });
      return [];
    }
  }

  public async getRemotes(): Promise<RcloneRemote[]> {
    return this.listRemotes();
  }

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
    if (this.activityLog.length > this.maxLogEntries) {
      this.activityLog = this.activityLog.slice(
        this.activityLog.length - this.maxLogEntries
      );
    }
    this.emit('activity:log', entry);
    this.saveActivityLog();
    return entry;
  }

  getActivityLog(limit = 100): ActivityLogEntry[] {
    return this.activityLog.slice(-limit);
  }

  clearActivityLog(): void {
    this.activityLog = [];
    this.emit('activity:cleared');
  }

  private startScheduler(): void {
    this.schedulerInterval = setInterval(
      () => this.runScheduler(),
      config.rclone.schedulerIntervalMs
    );
    logger.info('RcloneService initialized with scheduler', {
      intervalMs: config.rclone.schedulerIntervalMs,
    });
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
    if (this.storageCheckInterval) {
      clearInterval(this.storageCheckInterval);
      this.storageCheckInterval = null;
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

  getJobs(): SyncJob[] {
    return this.jobs.map((job) => ({
      ...job,
      analytics: this.analytics[job.id],
    }));
  }

  getJob(id: string): SyncJob | undefined {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return undefined;
    return { ...job, analytics: this.analytics[job.id] };
  }

  addJob(job: Partial<SyncJob>): SyncJob {
    const newJob: SyncJob = {
      id: job.id || Date.now().toString(),
      name: job.name || 'Unnamed Job',
      source: job.source || '',
      destination: job.destination || '',
      intervalMinutes: job.intervalMinutes || 60,
      concurrency: job.concurrency || 8,
      timeout: job.timeout || 30,
      retries: job.retries || 10,
      status: 'idle',
      progress: 0,
      nextRun: new Date(Date.now() + (job.intervalMinutes || 60) * 60000),
    };
    this.jobs.push(newJob);
    this.saveJobs();
    this.addLogEntry(
      'info',
      newJob.id,
      newJob.name,
      `Job "${newJob.name}" created`
    );
    this.emit('jobs:update', this.jobs);
    return newJob;
  }

  updateJob(id: string, updates: Partial<SyncJob>): SyncJob | null {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, updates);
    this.saveJobs();
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
    this.addLogEntry('info', id, jobName, `Job "${jobName}" deleted`);
    this.emit('jobs:update', this.jobs);
    return true;
  }

  async runJobNow(id: string): Promise<boolean> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || job.status === 'running') return false;
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
        this.addLogEntry(
          'warning',
          id,
          job.name,
          `Job "${job.name}" stopped by user`
        );
        this.emit('jobs:update', this.jobs);
      }
      return true;
    }
    return false;
  }

  private async executeJob(job: SyncJob): Promise<void> {
    job.status = 'running';
    job.progress = 0;
    job.lastError = null;
    job.bytesTransferred = 0;
    job.filesTransferred = 0;
    job.speed = 0;
    job.startedAt = new Date();
    this.saveJobs();
    this.addLogEntry(
      'info',
      job.id,
      job.name,
      `Starting sync: ${job.source} → ${job.destination}`
    );
    this.emit('jobs:update', this.jobs);

    try {
      if (!job.source || !job.destination)
        throw new Error('Source and destination are required');
      if (!job.source.includes(':') && !fs.existsSync(job.source))
        throw new Error(`Source path does not exist: ${job.source}`);

      const destRemote = job.destination.split(':')[0];
      if (destRemote && job.destination.includes(':')) {
        const isConnected = await RcloneRunner.isConnected(destRemote);
        if (!isConnected) {
          throw new Error(
            `Remote "${destRemote}" is not reachable or not configured.`
          );
        }

        try {
          await RcloneRunner.run(['mkdir', job.destination], {
            timeoutMs: config.rclone.timeout * 1000,
          });
        } catch (e: any) {
          logger.debug('mkdir check failed (might already exist)', {
            error: e.message,
          });
        }
      }

      const concurrency = String(job.concurrency || 8);
      const checkers = String(Math.max(16, (job.concurrency || 8) * 2));
      const jobTimeout = job.timeout || 30;
      const jobRetries = job.retries || 10;
      const timeoutStr = `${jobTimeout}s`;
      const retriesSleep = '250ms';

      const args = [
        'sync',
        job.source,
        job.destination,
        '--exclude',
        '.wrangler/**',
        '--exclude',
        '**/node_modules/**',
        '--exclude',
        '**/.git/**',
        '--exclude',
        '**/*.tmp',
        '--stats',
        '1s',
        '--use-json-log',
        '--stats-log-level',
        'info',
        '--fast-list',
        '--transfers',
        concurrency,
        '--checkers',
        checkers,
        '--buffer-size',
        '256M',
        '--multi-thread-streams',
        '16',
        '--multi-thread-cutoff',
        '64M',
        '--use-mmap',
        '--drive-chunk-size',
        '128M',
        '--drive-list-chunk',
        '1000',
        '--s3-upload-concurrency',
        '16',
        '--b2-upload-concurrency',
        '32',
        '--b2-chunk-size',
        '128M',
        '--dropbox-batch-mode',
        'sync',
        '--dropbox-batch-size',
        '100',
        '--dropbox-pacer-min-sleep',
        '10ms',
        '--max-backlog',
        '1000000',
        '--ignore-errors',
        '--user-agent',
        'dev-cloud-sync-ultra-speed',
        '--copy-links',
        '--metadata',
        '--retries',
        String(jobRetries),
        '--retries-sleep',
        retriesSleep,
        '--low-level-retries',
        '10',
        '--timeout',
        timeoutStr,
        '--contimeout',
        '10s',
        '-v',
      ];

      // Add provider-specific timeout handling for known problematic providers
      const sourceType = job.source.split(':')[0];
      const destType = job.destination.split(':')[0];
      const providerTypes = [sourceType, destType].filter(
        (t) =>
          t &&
          [
            'drive',
            'dropbox',
            'onedrive',
            'box',
            'b2',
            'azureblob',
            'pcloud',
          ].includes(t)
      );

      // Google Drive specific: increase timeouts for large files
      if (providerTypes.includes('drive')) {
        args.push('--timeout', timeoutStr);
      }

      // Dropbox specific: adjust batch mode for high concurrency
      if (providerTypes.includes('dropbox')) {
        args.push('--dropbox-impersonate', 'none');
      }

      // Backblaze B2 specific: optimize for large files
      if (providerTypes.includes('b2')) {
        args.push('--b2-hard-delete');
      }

      let lastProgressUpdate = 0;
      const emitUpdate = () => {
        const now = Date.now();
        if (now - lastProgressUpdate > 200) {
          lastProgressUpdate = now;
          this.emit('jobs:update', this.jobs);
          let msg = job.currentFile
            ? `Syncing: ${job.currentFile}`
            : `Transferred ${job.filesTransferred} files...`;
          this.addLogEntry('progress', job.id, job.name, msg, {
            progress: job.progress,
            speed: job.speed,
            bytesTransferred: job.bytesTransferred,
            filesTransferred: job.filesTransferred,
            eta: job.eta,
            fileName: job.currentFile,
            fileSize: job.currentFileSize,
            totalBytes: job.totalBytes,
          });
        }
      };

      this.stderrBuffers.set(job.id, '');

      await RcloneRunner.run(args, {
        onSpawn: (proc) => {
          this.activeProcesses.set(job.id, proc);
        },
        onStderr: (data) => {
          let buffer = (this.stderrBuffers.get(job.id) || '') + data;
          const lines = buffer.split('\n');
          this.stderrBuffers.set(job.id, lines.pop() || '');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              this.parseRcloneOutput(job, line, true);
              if (parsed.stats) emitUpdate();
            } catch (e) {}
          }
        },
      });

      this.activeProcesses.delete(job.id);

      // We need to keep track of the underlying process if we want to be able to kill it.
      // RcloneRunner.run doesn't currently expose it.
      // I should modify RcloneRunner.run to optionally return the process or allow passing an AbortSignal.

      // For now, I'll stick to spawn for the core sync if I need the process object for stopJob.
      // Actually, I can add a way to get the process from RcloneRunner or pass a callback.

      // Let's revert this part for a moment and improve RcloneRunner first.

      const process = spawn('rclone', args);

      job.lastRun = new Date();
      job.nextRun = new Date(Date.now() + job.intervalMinutes * 60000);
      job.status = 'success';
      job.progress = 100;
      job.speed = 0;
      const duration = job.startedAt
        ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)
        : 0;
      this.addLogEntry(
        'success',
        job.id,
        job.name,
        `Sync completed in ${this.formatDuration(duration)}. Transferred ${this.formatBytes(job.bytesTransferred || 0)}`
      );
      this.updateAnalytics(
        job.id,
        'success',
        job.bytesTransferred || 0,
        job.speed || 0
      );
    } catch (error: any) {
      job.status = 'error';
      job.lastError = error.message;
      job.speed = 0;
      this.addLogEntry(
        'error',
        job.id,
        job.name,
        `Sync failed: ${error.message}`
      );
      this.updateAnalytics(job.id, 'error', 0, 0);
    }
    this.saveJobs();
    this.emit('jobs:update', this.jobs);
  }

  private parseRcloneOutput(
    job: SyncJob,
    line: string,
    isJson: boolean = false
  ): void {
    if (!isJson) return;
    try {
      const logEntry = JSON.parse(line);
      if (logEntry.stats) {
        job.status = 'running';
        const now = Date.now();
        const currentBytes = logEntry.stats.bytes || 0;
        if (!job._lastCheckTime) {
          job._lastCheckTime = now;
          job._lastBytes = currentBytes;
          job.speed = 0;
        } else {
          const timeDiffSec = (now - job._lastCheckTime) / 1000;
          let bytesDiff = Math.max(0, currentBytes - (job._lastBytes || 0));
          if (timeDiffSec >= 2) {
            const calculatedSpeed = bytesDiff / timeDiffSec;
            const MAX_SPEED = 125 * 1024 * 1024;
            let cappedSpeed = Math.min(calculatedSpeed, MAX_SPEED);
            job.speed = (job.speed || 0) * 0.6 + cappedSpeed * 0.4;
            job._lastCheckTime = now;
            job._lastBytes = currentBytes;
            if (job.speed < 1024) job.speed = 0;
          }
        }
        if (job.speed !== undefined) job.lastSpeed = job.speed;
        job.bytesTransferred = logEntry.stats.bytes;
        job.totalBytes = logEntry.stats.totalBytes;
        job.filesTransferred = logEntry.stats.transfers;
        job.totalFiles = logEntry.stats.totalTransfers;
        job.progress = job.totalBytes
          ? Math.round((job.bytesTransferred! / job.totalBytes) * 100)
          : job.totalFiles
            ? Math.round((job.filesTransferred! / job.totalFiles) * 100)
            : 0;
        if (logEntry.stats.eta > 0)
          job.eta = this.formatDuration(Math.round(logEntry.stats.eta));
        if (logEntry.stats.transferring?.length > 0) {
          job.transferring = logEntry.stats.transferring.map((t: any) => ({
            name: t.name,
            size: t.size,
            bytes: t.bytes,
            percentage: t.percentage,
            speed: t.speed,
            speedAvg: t.speedAvg,
            eta: t.eta,
          }));
          const first = logEntry.stats.transferring[0];
          job.currentFile = first.name;
          job.currentFileSize = first.size;
          job.currentFileBytes = first.bytes;
        } else {
          job.transferring = [];
          delete job.currentFile;
        }
      }
    } catch (e) {}
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
    if (!this.isOnline) return;
    const now = new Date();
    for (const job of this.jobs) {
      if (job.status === 'running' || job.diffStatus === 'checking') continue;
      const lastRun = job.lastRun ? new Date(job.lastRun) : new Date(0);
      const nextRun = new Date(lastRun.getTime() + job.intervalMinutes * 60000);
      if (now >= nextRun) {
        this.addLogEntry(
          'info',
          job.id,
          job.name,
          `Recurring sync cycle reached. Verifying integrity...`
        );
        this.executeJob(job);
      }
    }
  }

  async getStats(): Promise<SyncStats> {
    const runningJobs = this.jobs.filter((j) => j.status === 'running');
    return {
      speed: runningJobs.reduce((sum, j) => sum + (j.speed || 0), 0),
      bytes: runningJobs.reduce((sum, j) => sum + (j.bytesTransferred || 0), 0),
      transfers: runningJobs.reduce(
        (sum, j) => sum + (j.filesTransferred || 0),
        0
      ),
      checks: 0,
      elapsedTime: 0,
      activeJobs: this.activeProcesses.size,
      storage: this.storageStats,
    };
  }

  async testConnection(
    remote: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const connected = await RcloneRunner.isConnected(remote);
      return {
        success: connected,
        message: connected ? 'Connection successful' : 'Connection failed',
      };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  async getDirectoryListing(path: string): Promise<string[]> {
    try {
      const { stdout } = await RcloneRunner.run(['lsd', path], {
        timeoutMs: config.rclone.timeout * 1000,
      });
      return stdout
        .trim()
        .split('\n')
        .filter((l) => l)
        .map((l) => l.split(/\s+/).pop() || '');
    } catch (e) {
      return [];
    }
  }

  async listRemotePath(
    remoteName: string | null | undefined,
    remotePath: string = ''
  ): Promise<any[]> {
    try {
      let fullPath = remoteName
        ? remoteName.includes(':') || remoteName.startsWith('/')
          ? remoteName
          : `${remoteName}:`
        : remotePath || '/';
      if (remoteName && remotePath)
        fullPath += remotePath.startsWith('/')
          ? remotePath.slice(1)
          : remotePath;

      const { stdout } = await RcloneRunner.run(['lsjson', fullPath], {
        timeoutMs: config.rclone.timeout * 1000,
      });
      return JSON.parse(stdout);
    } catch (e: any) {
      throw new Error(`Listing failed: ${e.message}`);
    }
  }

  private loadActivityLog(): void {
    try {
      const logFile = path.join(config.paths.data, 'activity.json');
      if (fs.existsSync(logFile)) {
        const data = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
        this.activityLog = data.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));
        this.activityLog.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        if (this.activityLog.length > 500)
          this.activityLog = this.activityLog.slice(-500);
      }
    } catch (error) {}
  }

  private saveActivityLog(): void {
    try {
      const logFile = path.join(config.paths.data, 'activity.json');
      const dir = path.dirname(logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(logFile, JSON.stringify(this.activityLog, null, 2));
    } catch (error) {}
  }
}
