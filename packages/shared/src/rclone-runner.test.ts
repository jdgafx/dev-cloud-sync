import { spawn } from 'child_process';
import { RcloneRunner } from './rclone-runner';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('RcloneRunner', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
  });

  test('runs rclone with args array and does not use shell', async () => {
    const fakeProc: any = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, cb: Function) => {
        if (event === 'close') setImmediate(() => cb(0));
      }),
    };
    (spawn as jest.Mock).mockReturnValue(fakeProc);

    const args = ['config', 'show', 'myremote'];
    const result = await RcloneRunner.run(args);

    expect(spawn).toHaveBeenCalledWith('rclone', args, expect.any(Object));
    expect(result.code).toBe(0);
  });

  test('rejects on timeout', async () => {
    const fakeProc: any = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };
    (spawn as jest.Mock).mockReturnValue(fakeProc);

    await expect(
      RcloneRunner.run(['version'], { timeoutMs: 1 })
    ).rejects.toThrow('rclone: timeout');
  });

  test('does not execute shell when args contain malicious string', async () => {
    const fakeProc: any = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, cb: Function) => {
        if (event === 'close') setImmediate(() => cb(0));
      }),
    };
    (spawn as jest.Mock).mockReturnValue(fakeProc);

    const dangerous = 'name; rm -rf /';
    await RcloneRunner.run(['config', 'show', dangerous]);

    expect(spawn).toHaveBeenCalledWith(
      'rclone',
      ['config', 'show', dangerous],
      expect.any(Object)
    );
  });
});
