import { Router } from 'express';
import { createJobsRouter } from './jobs.routes';
import { createRemotesRouter } from './remotes.routes';
import { createStatsRouter } from './stats.routes';
import { createActivityRouter } from './activity.routes';
import { createFilesRouter } from './files.routes';
import { createUsersRouter } from './users.routes';
import { RcloneService } from '../services/rclone.service';

/**
 * Create and mount all API v1 routes
 */
export function createApiRouter(rclone: RcloneService, io: any): Router {
    const router = Router();

    // Mount route modules under /api/v1
    router.use('/jobs', createJobsRouter(rclone, io));
    router.use('/remotes', createRemotesRouter(rclone));
    router.use('/stats', createStatsRouter(rclone));
    router.use('/activity', createActivityRouter(rclone));
    router.use('/files', createFilesRouter(rclone));
    router.use('/users', createUsersRouter());

    return router;
}

export default createApiRouter;
