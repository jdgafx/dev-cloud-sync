import { Router } from 'express';
import Joi from 'joi';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validate } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

const execAsync = promisify(exec);
const router = Router();

/**
 * Remote type configurations
 */
const REMOTE_TYPES = {
    drive: {
        name: 'Google Drive',
        icon: 'google-drive',
        fields: [
            { name: 'client_id', label: 'Client ID', type: 'text', optional: true },
            { name: 'client_secret', label: 'Client Secret', type: 'password', optional: true },
            { name: 'root_folder_id', label: 'Root Folder ID', type: 'text', optional: true, placeholder: 'Leave empty for entire drive' },
        ],
        authRequired: true,
    },
    s3: {
        name: 'Amazon S3',
        icon: 'aws',
        fields: [
            { name: 'access_key_id', label: 'Access Key ID', type: 'text', required: true },
            { name: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
            { name: 'region', label: 'Region', type: 'select', options: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'], required: true },
            { name: 'bucket', label: 'Bucket Name', type: 'text', optional: true },
        ],
    },
    dropbox: {
        name: 'Dropbox',
        icon: 'dropbox',
        fields: [
            { name: 'client_id', label: 'App Key', type: 'text', optional: true },
            { name: 'client_secret', label: 'App Secret', type: 'password', optional: true },
        ],
        authRequired: true,
    },
    onedrive: {
        name: 'Microsoft OneDrive',
        icon: 'microsoft',
        fields: [
            { name: 'client_id', label: 'Client ID', type: 'text', optional: true },
            { name: 'client_secret', label: 'Client Secret', type: 'password', optional: true },
        ],
        authRequired: true,
    },
    sftp: {
        name: 'SFTP',
        icon: 'server',
        fields: [
            { name: 'host', label: 'Host', type: 'text', required: true },
            { name: 'port', label: 'Port', type: 'number', default: 22 },
            { name: 'user', label: 'Username', type: 'text', required: true },
            { name: 'pass', label: 'Password', type: 'password', optional: true },
            { name: 'key_file', label: 'SSH Key File Path', type: 'text', optional: true },
        ],
    },
    local: {
        name: 'Local Filesystem',
        icon: 'folder',
        fields: [],
    },
};

/**
 * Validation schemas
 */
const createRemoteSchema = Joi.object({
    name: Joi.string().min(1).max(50).pattern(/^[a-zA-Z0-9_-]+$/).required()
        .messages({ 'string.pattern.base': 'Name must only contain letters, numbers, underscores, and hyphens' }),
    type: Joi.string().valid(...Object.keys(REMOTE_TYPES)).required(),
    config: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
});

const updateRemoteSchema = Joi.object({
    config: Joi.object().pattern(Joi.string(), Joi.any()).required(),
});

const browseSchema = Joi.object({
    path: Joi.string().required(),
});

const testSchema = Joi.object({
    remote: Joi.string().required(),
});

/**
 * GET /api/v1/remotes - List all remotes with their types
 */
router.get('/', async (_req, res) => {
    try {
        const { stdout } = await execAsync('rclone listremotes --long 2>/dev/null || rclone listremotes');
        const lines = stdout.trim().split('\n').filter(l => l);

        const remotes = lines.map(line => {
            const parts = line.split(':');
            const name = parts[0]?.trim();
            const type = parts[1]?.trim() || 'unknown';
            if (!name) return null;

            const typeConfig = REMOTE_TYPES[type as keyof typeof REMOTE_TYPES];
            return {
                name,
                type,
                displayName: typeConfig?.name || type,
                icon: typeConfig?.icon || 'cloud',
                configurable: !!typeConfig,
            };
        }).filter(Boolean);

        sendSuccess(res, remotes);
    } catch (e) {
        logger.error('Failed to list remotes', { error: (e as Error).message });
        sendSuccess(res, []);
    }
});

/**
 * GET /api/v1/remotes/types - Get available remote types for creation
 */
router.get('/types', (_req, res) => {
    const types = Object.entries(REMOTE_TYPES).map(([key, config]) => ({
        id: key,
        name: config.name,
        icon: config.icon,
        fields: config.fields,
        authRequired: !!(config as any).authRequired,
    }));
    sendSuccess(res, types);
});

/**
 * GET /api/v1/remotes/:name - Get remote configuration
 */
router.get('/:name', async (req, res, next) => {
    const { name } = req.params;
    try {
        const { stdout } = await execAsync(`rclone config show "${name}" 2>&1`);

        // Parse the config output
        const lines = stdout.split('\n');
        const config: Record<string, string> = {};

        for (const line of lines) {
            if (line.includes('=')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                // Don't expose tokens or secrets
                if (key && !key.includes('token') && !key.includes('secret') && !key.includes('pass')) {
                    config[key.trim()] = value;
                } else if (key) {
                    config[key.trim()] = '********';
                }
            }
        }

        sendSuccess(res, { name, config });
    } catch (e: any) {
        if (e.message.includes("didn't find section")) {
            sendError(res, 'NOT_FOUND', `Remote "${name}" not found`, 404);
        } else {
            next(e);
        }
    }
});

/**
 * POST /api/v1/remotes - Create a new remote
 */
router.post('/', validate(createRemoteSchema, 'body'), async (req, res, next) => {
    const { name, type, config } = req.body;

    try {
        // Check if remote already exists
        const { stdout: existing } = await execAsync('rclone listremotes');
        if (existing.includes(`${name}:`)) {
            throw new BadRequestError(`Remote "${name}" already exists`);
        }

        // Build rclone config create command
        let cmd = `rclone config create "${name}" "${type}"`;

        for (const [key, value] of Object.entries(config)) {
            if (value && typeof value === 'string' && value.trim()) {
                cmd += ` "${key}" "${value}"`;
            }
        }

        await execAsync(cmd);

        logger.info('Created remote', { name, type });
        sendSuccess(res, { name, type, message: 'Remote created successfully' }, 201);
    } catch (e: any) {
        logger.error('Failed to create remote', { error: e.message });
        if (e instanceof BadRequestError) return next(e);
        next(new BadRequestError(e.message));
    }
});

/**
 * PUT /api/v1/remotes/:name - Update remote configuration
 */
router.put('/:name', validate(updateRemoteSchema, 'body'), async (req, res, next) => {
    const { name } = req.params;
    const { config } = req.body;

    try {
        // Update each config value
        for (const [key, value] of Object.entries(config)) {
            if (value !== '********') { // Don't update masked fields
                const valueStr = value === '' || value === null ? '' : String(value);
                await execAsync(`rclone config update "${name}" "${key}" "${valueStr}"`);
            }
        }

        logger.info('Updated remote', { name });
        sendSuccess(res, { name, message: 'Remote updated successfully' });
    } catch (e: any) {
        logger.error('Failed to update remote', { error: e.message });
        next(new BadRequestError(e.message));
    }
});

/**
 * DELETE /api/v1/remotes/:name - Delete a remote
 */
router.delete('/:name', async (req, res, next) => {
    const { name } = req.params;

    try {
        await execAsync(`rclone config delete "${name}"`);
        logger.info('Deleted remote', { name });
        sendSuccess(res, { deleted: true });
    } catch (e: any) {
        logger.error('Failed to delete remote', { error: e.message });
        next(new BadRequestError(e.message));
    }
});

/**
 * POST /api/v1/remotes/test - Test remote connection
 */
router.post('/test', validate(testSchema, 'body'), async (req, res, next) => {
    const { remote } = req.body;

    try {
        const startTime = Date.now();
        await execAsync(`rclone lsd "${remote}" --max-depth 0 --timeout 15s`);
        const latency = Date.now() - startTime;

        sendSuccess(res, {
            success: true,
            message: 'Connection successful',
            latency,
        });
    } catch (e: any) {
        sendSuccess(res, {
            success: false,
            message: e.message.includes('404')
                ? 'Remote path not found'
                : e.message.includes('403')
                    ? 'Permission denied'
                    : 'Connection failed: ' + e.message.substring(0, 100),
        });
    }
});

/**
 * GET /api/v1/remotes/browse - Browse remote directory
 */
router.get('/browse', validate(browseSchema, 'query'), async (req, res) => {
    const remotePath = req.query.path as string;

    try {
        const { stdout } = await execAsync(`rclone lsjson "${remotePath}" --dirs-only --max-depth 1 --timeout 30s`);
        const items = JSON.parse(stdout || '[]');

        const folders = items.map((item: any) => ({
            name: item.Name,
            path: `${remotePath}${remotePath.endsWith(':') ? '' : '/'}${item.Name}`,
            modTime: item.ModTime,
        }));

        sendSuccess(res, folders);
    } catch (e: any) {
        logger.error('Failed to browse remote', { path: remotePath, error: e.message });
        sendSuccess(res, []);
    }
});

// Factory function to create the router (consistent with other routes)
export function createRemotesRouter(rclone: any): Router {
    // We can inject rclone service here if needed in future
    return router;
}

export { router as remotesRouter };
export default createRemotesRouter;
