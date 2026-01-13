import fs from 'fs';

jest.mock('@dev-cloud-sync/shared', () => ({
  RcloneRunner: {
    run: jest.fn(),
    isConnected: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.mock('dns', () => ({
  promises: {
    resolve: jest.fn().mockResolvedValue(['1.1.1.1']),
  },
}));

jest.mock('../../src/config', () => ({
  default: {
    paths: {
      jobsFile: '/mock/jobs.json',
      data: '/mock/data',
    },
    rclone: {
      schedulerIntervalMs: 60000,
      timeout: 30,
    },
    logging: {
      level: 'info',
    },
    isProd: false,
  },
  __esModule: true,
}));

import { RcloneService } from '../../src/services/rclone.service';
import { RcloneRunner } from '@dev-cloud-sync/shared';

describe('Job Execution Guard Tests', () => {
  let service: RcloneService;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (RcloneRunner.run as jest.Mock).mockResolvedValue({
      stdout: '',
      stderr: '',
      code: 0,
    });
    service = new RcloneService();
  });

  it('executeJob throws error if remote is unreachable', async () => {
    const job = {
      id: '1',
      name: 'Test Job',
      source: '/local/path',
      destination: 'drive:backup',
      intervalMinutes: 60,
      status: 'idle' as const,
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (RcloneRunner.isConnected as jest.Mock).mockResolvedValue(false);

    (service as any).jobs = [job];

    await (service as any).executeJob(job);

    const updatedJob = service.getJob('1');
    expect(updatedJob?.status).toBe('error');
    expect(updatedJob?.lastError).toContain('Remote "drive" is not reachable');
  });

  it('executeJob proceeds if remote is reachable', async () => {
    const job = {
      id: '2',
      name: 'Test Job 2',
      source: '/local/path',
      destination: 'drive:backup',
      intervalMinutes: 60,
      status: 'idle' as const,
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (RcloneRunner.isConnected as jest.Mock).mockResolvedValue(true);
    (RcloneRunner.run as jest.Mock).mockResolvedValue({
      stdout: '',
      stderr: '',
      code: 0,
    });

    (service as any).jobs = [job];

    await (service as any).executeJob(job);

    const updatedJob = service.getJob('2');
    expect(updatedJob?.status).toBe('success');
  });
});
