import { Router } from 'express';
import { sendSuccess } from '../utils/response';
import { RcloneService } from '../services/rclone.service';

const router = Router();

/**
 * Factory function to create routes with injected service
 */
export function createStatsRouter(rclone: RcloneService): Router {
    // GET /api/v1/stats - Get sync statistics
    router.get('/', async (_req, res) => {
        const stats = await rclone.getStats();
        sendSuccess(res, stats);
    });

    return router;
}

export default router;
