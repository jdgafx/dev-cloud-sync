import { spawn } from 'child_process';

export class RcloneRunner {
  static run(
    args: string[],
    opts: {
      timeoutMs?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
      onSpawn?: (proc: ReturnType<typeof spawn>) => void;
      allowedExitCodes?: number[];
    } = {}
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    const allowedExitCodes = opts.allowedExitCodes || [0];
    return new Promise((resolve, reject) => {
      const proc = spawn('rclone', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      if (opts.onSpawn) opts.onSpawn(proc);

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

      proc.stdout?.on('data', (d: any) => {
        const str = d.toString();
        stdout += str;
        if (opts.onStdout) opts.onStdout(str);
      });
      proc.stderr?.on('data', (d: any) => {
        const str = d.toString();
        stderr += str;
        if (opts.onStderr) opts.onStderr(str);
      });

      proc.on('close', (code: number | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (timedOut) return reject(new Error('rclone: timeout'));
        const safeStdout = String(stdout).slice(0, 100000);
        const safeStderr = String(stderr).slice(0, 100000);

        const exitCode = code || 0;
        if (!allowedExitCodes.includes(exitCode)) {
          const errMsg =
            safeStderr || safeStdout || `rclone exited with code ${exitCode}`;
          return reject(
            new Error(`rclone exited with code ${exitCode}: ${errMsg}`)
          );
        }
        resolve({ stdout: safeStdout, stderr: safeStderr, code: exitCode });
      });

      proc.on('error', (err: any) => reject(err));
    });
  }

  static async isConnected(remoteName: string): Promise<boolean> {
    try {
      const remote = remoteName.endsWith(':') ? remoteName : `${remoteName}:`;
      await this.run(['lsd', remote, '--max-depth', '0'], { timeoutMs: 5000 });
      return true;
    } catch (err) {
      return false;
    }
  }
}
