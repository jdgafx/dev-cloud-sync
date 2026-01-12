import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../utils/response';
import { RcloneService } from '../services/rclone.service';

const router = Router();

const listFilesSchema = Joi.object({
    remote: Joi.string().allow('').required(),
    path: Joi.string().allow('').default(''),
});

export function createFilesRouter(rclone: RcloneService): Router {
    router.get('/list', validate(listFilesSchema, 'query'), async (req, res, next) => {
        try {
            const { remote, path } = req.query as any;
            const files = await rclone.listRemotePath(remote, path);
            sendSuccess(res, files);
        } catch (e) {
            next(e);
        }
    });

    return router;
}

export default router;
