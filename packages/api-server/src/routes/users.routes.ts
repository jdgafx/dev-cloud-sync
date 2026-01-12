import { Router } from 'express';
import Joi from 'joi';
import { userService } from '../services/user.service';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../utils/response';
import { NotFoundError } from '../utils/errors';

const router = Router();

const userSchema = Joi.object({
    username: Joi.string().min(3).max(50).required(),
    password: Joi.string().min(6),
    email: Joi.string().email(),
    is_admin: Joi.boolean(),
    settings: Joi.object(),
});

export function createUsersRouter(): Router {
    // GET /api/v1/users - List all users
    router.get('/', async (_req, res, next) => {
        try {
            const users = await userService.getUsers();
            sendSuccess(res, users);
        } catch (err) {
            next(err);
        }
    });

    // GET /api/v1/users/:id - Get single user
    router.get('/:id', async (req, res, next) => {
        try {
            const user = await userService.getUserById(parseInt(req.params.id));
            if (!user) throw new NotFoundError('User');
            sendSuccess(res, user);
        } catch (err) {
            next(err);
        }
    });

    // POST /api/v1/users - Create user
    router.post('/', validate(userSchema, 'body'), async (req, res, next) => {
        try {
            const user = await userService.createUser(req.body);
            sendSuccess(res, user, 201);
        } catch (err) {
            next(err);
        }
    });

    // PUT /api/v1/users/:id - Update user
    router.put('/:id', validate(userSchema.fork(['username'], (schema) => schema.optional()), 'body'), async (req, res, next) => {
        try {
            const id = req.params.id;
            if (!id) throw new Error('User ID is required');
            const user = await userService.updateUser(parseInt(id), req.body);
            if (!user) throw new NotFoundError('User');
            sendSuccess(res, user);
        } catch (err) {
            next(err);
        }
    });

    // DELETE /api/v1/users/:id - Delete user
    router.delete('/:id', async (req, res, next) => {
        try {
            const success = await userService.deleteUser(parseInt(req.params.id));
            if (!success) throw new NotFoundError('User');
            sendSuccess(res, { deleted: true });
        } catch (err) {
            next(err);
        }
    });

    return router;
}

export default router;
