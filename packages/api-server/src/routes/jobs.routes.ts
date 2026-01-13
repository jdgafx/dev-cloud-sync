import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { RcloneService } from '../services/rclone.service';

const router = Router();

/**
 * Validation schemas
 */
const createJobSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  source: Joi.string().min(1).required(),
  destination: Joi.string().min(1).required(),
  intervalMinutes: Joi.number().integer().min(1).max(10080).default(60), // max 1 week
  concurrency: Joi.number().integer().min(1).max(1000).default(8),
  timeout: Joi.number().integer().min(10).max(600).default(30), // timeout in seconds
  retries: Joi.number().integer().min(1).max(100).default(10),
});

const updateJobSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  source: Joi.string().min(1),
  destination: Joi.string().min(1),
  intervalMinutes: Joi.number().integer().min(1).max(10080),
  concurrency: Joi.number().integer().min(1).max(1000),
  timeout: Joi.number().integer().min(10).max(600),
  retries: Joi.number().integer().min(1).max(100),
}).min(1); // At least one field required

const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

/**
 * Factory function to create routes with injected service
 */
export function createJobsRouter(rclone: RcloneService, io: any): Router {
  // GET /api/v1/jobs - List all jobs
  router.get('/', (_req, res) => {
    const jobs = rclone.getJobs();
    sendSuccess(res, jobs);
  });

  // GET /api/v1/jobs/:id - Get single job
  router.get('/:id', validate(idParamSchema, 'params'), (req, res) => {
    const job = rclone.getJob(req.params.id!);
    if (!job) {
      throw new NotFoundError('Job');
    }
    sendSuccess(res, job);
  });

  // POST /api/v1/jobs - Create job
  router.post('/', validate(createJobSchema, 'body'), (req, res) => {
    const job = rclone.addJob(req.body);
    io.emit('jobs:update', rclone.getJobs());
    sendSuccess(res, job, 201);
  });

  // PUT /api/v1/jobs/:id - Update job
  router.put(
    '/:id',
    validate(idParamSchema, 'params'),
    validate(updateJobSchema, 'body'),
    (req, res) => {
      const job = rclone.updateJob(req.params.id!, req.body);
      if (!job) {
        throw new NotFoundError('Job');
      }
      io.emit('jobs:update', rclone.getJobs());
      sendSuccess(res, job);
    }
  );

  // DELETE /api/v1/jobs/:id - Delete job
  router.delete('/:id', validate(idParamSchema, 'params'), (req, res) => {
    const success = rclone.removeJob(req.params.id!);
    if (!success) {
      throw new NotFoundError('Job');
    }
    io.emit('jobs:update', rclone.getJobs());
    sendSuccess(res, { deleted: true });
  });

  // POST /api/v1/jobs/:id/run - Start job
  router.post(
    '/:id/run',
    validate(idParamSchema, 'params'),
    async (req, res, next) => {
      try {
        const success = await rclone.runJobNow(req.params.id!);
        if (!success) {
          throw new BadRequestError(
            'Could not start job. It may already be running or does not exist.'
          );
        }
        io.emit('jobs:update', rclone.getJobs());
        sendSuccess(res, { message: 'Job started' });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/jobs/:id/stop - Stop job
  router.post('/:id/stop', validate(idParamSchema, 'params'), (req, res) => {
    const success = rclone.stopJob(req.params.id!);
    if (!success) {
      throw new BadRequestError('Job is not running');
    }
    io.emit('jobs:update', rclone.getJobs());
    sendSuccess(res, { message: 'Job stopped' });
  });

  return router;
}

export default router;
