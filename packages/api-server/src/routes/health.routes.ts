import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
const execAsync = promisify(exec);
import { RcloneRunner } from '@dev-cloud-sync/shared';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

interface CheckResult {
  status: 'ok' | 'error';
  message?: string;
}

interface ReadinessStatus extends HealthStatus {
  checks: {
    rclone: CheckResult;
  };
}

/**
 * GET /health - Liveness check
 * Returns 200 if the server is running (for load balancers)
 */
router.get('/health', (_req: Request, res: Response) => {
  const status: HealthStatus = {
    status: 'ok',
    service: 'cloudsync-api',
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  sendSuccess(res, status);
});

/**
 * GET /ready - Readiness check
 * Returns 200 only if all dependencies are available
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: { rclone: CheckResult } = {
    rclone: { status: 'ok' },
  };

  // Check rclone availability
  try {
    await RcloneRunner.run(['version', '--timeout', '5s']);
    checks.rclone = { status: 'ok' };
  } catch (e: any) {
    checks.rclone = { status: 'error', message: 'rclone not available' };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  const status: ReadinessStatus = {
    status: allHealthy ? 'ok' : 'degraded',
    service: 'cloudsync-api',
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  };

  if (allHealthy) {
    sendSuccess(res, status);
  } else {
    // Return 503 for k8s readiness probe failure
    sendError(
      res,
      'SERVICE_DEGRADED',
      'Some dependencies unavailable',
      503,
      checks
    );
  }
});

export default router;
