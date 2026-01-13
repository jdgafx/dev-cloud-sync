import { exec } from 'child_process';
import { promisify } from 'util';
import { SyncConfig } from './types';
import { RcloneRunner } from '@dev-cloud-sync/shared';

const execAsync = promisify(exec);

export class RcloneSync {
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
  }

  /**
   * Check if rclone is installed and available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await RcloneRunner.run(['--version']);
      return true;
    } catch (error) {
      console.error('Failed to check rclone availability:', error);
      return false;
    }
  }

  /**
   * List configured remotes
   */
  async listRemotes(): Promise<string[]> {
    try {
      const { stdout } = await RcloneRunner.run(['listremotes']);
      return stdout
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => line.replace(':', ''));
    } catch (error) {
      console.error('Failed to list remotes:', error);
      return [];
    }
  }

  /**
   * Sync a local directory to a remote destination
   */
  async syncToRemote(
    localPath: string,
    remoteName: string,
    remotePath: string
  ): Promise<void> {
    const args = [
      'sync',
      localPath,
      `${remoteName}:${remotePath}`,
      '--progress',
    ];
    console.log('Executing: rclone', args.join(' '));

    try {
      await RcloneRunner.run(args);
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync from remote to local directory
   */
  async syncFromRemote(
    remoteName: string,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const args = [
      'sync',
      `${remoteName}:${remotePath}`,
      localPath,
      '--progress',
    ];
    console.log('Executing: rclone', args.join(' '));

    try {
      await RcloneRunner.run(args);
      console.log('Sync from remote completed successfully');
    } catch (error) {
      console.error('Sync from remote failed:', error);
      throw error;
    }
  }

  /**
   * Mount a remote to a local path (requires FUSE)
   */
  async mount(
    remoteName: string,
    remotePath: string,
    mountPoint: string
  ): Promise<void> {
    const args = [
      'mount',
      `${remoteName}:${remotePath}`,
      mountPoint,
      '--daemon',
    ];
    console.log('Mounting: rclone', args.join(' '));
    await RcloneRunner.run(args);
  }

  /**
   * Unmount a mounted remote
   */
  async unmount(mountPoint: string): Promise<void> {
    const command = `fusermount -u "${mountPoint}"`;
    console.log(`Unmounting: ${command}`);
    await execAsync(command);
  }

  /**
   * Get remote info/about
   */
  async getRemoteInfo(remoteName: string): Promise<string> {
    try {
      const { stdout } = await RcloneRunner.run(['about', `${remoteName}:`]);
      return stdout;
    } catch (error) {
      console.error('Failed to get remote info:', error);
      throw error;
    }
  }

  /**
   * Copy a single file to remote
   */
  async copyFile(
    localPath: string,
    remoteName: string,
    remotePath: string
  ): Promise<void> {
    const args = ['copy', localPath, `${remoteName}:${remotePath}`];
    console.log('Copying: rclone', args.join(' '));

    try {
      await RcloneRunner.run(args);
      console.log('Copy completed successfully');
    } catch (error) {
      console.error('Copy failed:', error);
      throw error;
    }
  }

  /**
   * Delete a file from remote
   */
  async deleteRemoteFile(
    remoteName: string,
    remotePath: string
  ): Promise<void> {
    const args = ['delete', `${remoteName}:${remotePath}`];
    console.log('Deleting: rclone', args.join(' '));

    try {
      await RcloneRunner.run(args);
      console.log('Delete completed successfully');
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  }
}
