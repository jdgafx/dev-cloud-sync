import { exec } from 'child_process';
import { promisify } from 'util';
import { SyncConfig } from './types';

const execAsync = promisify(exec);

export class RcloneSync {
    constructor(private config: SyncConfig) { }

    /**
     * Check if rclone is installed and available
     */
    async isAvailable(): Promise<boolean> {
        try {
            await execAsync('rclone --version');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * List configured remotes
     */
import { exec } from 'child_process';
import { promisify } from 'util';
import { SyncConfig } from './types';
import logger from '@dev-cloud-sync/api-server/utils/logger';

const execAsync = promisify(exec);

export class RcloneSync {
    constructor(private config: SyncConfig) { }

    /**
     * Check if rclone is installed and available
     */
    async isAvailable(): Promise<boolean> {
        try {
            await execAsync('rclone --version');
            return true;
        } catch (error) {
            logger.error('Failed to check rclone availability:', error);
            return false;
        }
    }

    /**
     * List configured remotes
     */
    async listRemotes(): Promise<string[]> {
        try {
            const { stdout } = await execAsync('rclone listremotes');
            return stdout.split('\n').filter(line => line.trim().length > 0).map(line => line.replace(':', ''));
        } catch (error) {
            logger.error('Failed to list remotes:', error);
            return [];
        }
    }

    /**
     * Sync a local directory to a remote destination
     */
    async syncToRemote(localPath: string, remoteName: string, remotePath: string): Promise<void> {
        const command = `rclone sync "${localPath}" "${remoteName}:${remotePath}" --progress`;
        logger.info(`Executing: ${command}`);

        // In a real implementation, we would spawn this and stream stdout/stderr for progress
        try {
            await execAsync(command);
            logger.info('Sync completed successfully');
        } catch (error) {
            logger.error('Sync failed:', error);
            throw error;
        }
    }

    /**
     * Mount a remote to a local path (requires FUSE)
     */
    async mount(remoteName: string, remotePath: string, mountPoint: string): Promise<void> {
        const command = `rclone mount "${remoteName}:${remotePath}" "${mountPoint}" --daemon`;
        logger.info(`Mounting: ${command}`);
        await execAsync(command);
    }
}
}
