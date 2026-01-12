import { Router } from 'express';
import { sendSuccess } from '../utils/response';
import { RcloneService } from '../services/rclone.service';

/**
 * Factory function to create activity routes with injected service
 */
export function createActivityRouter(rclone: RcloneService): Router {
    const router = Router();

    // GET /api/v1/activity - Get activity log
    router.get('/', (req, res) => {
        const limit = parseInt(req.query.limit as string) || 100;
        const logs = rclone.getActivityLog(limit);
        sendSuccess(res, logs);
    });

    // DELETE /api/v1/activity - Clear activity log
    router.delete('/', (_req, res) => {
        rclone.clearActivityLog();
        sendSuccess(res, { cleared: true });
    });

    return router;
}

export default createActivityRouter;
