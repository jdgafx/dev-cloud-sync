import { spawn } from 'child_process';

export class RcloneRunner {
  static run(
    args: string[],
    opts: { timeoutMs?: number } = {}
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('rclone', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      let timeoutId: NodeJS.Timeout | null = null;
      if (opts.timeoutMs) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGTERM');
        }, opts.timeoutMs);
      }

      proc.stdout?.on('data', (d: any) => (stdout += d.toString()));
      proc.stderr?.on('data', (d: any) => (stderr += d.toString()));

      proc.on('close', (code: number | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (timedOut) return reject(new Error('rclone: timeout'));
        const safeStdout = String(stdout).slice(0, 100000);
        const safeStderr = String(stderr).slice(0, 100000);
        resolve({ stdout: safeStdout, stderr: safeStderr, code: code || 0 });
      });

      proc.on('error', (err: any) => reject(err));
    });
  }
}
