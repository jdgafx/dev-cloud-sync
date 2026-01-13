import { Router } from 'express';
import Joi from 'joi';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validate } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

const execAsync = promisify(exec);
import { RcloneRunner } from '@dev-cloud-sync/shared';
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
      {
        name: 'client_secret',
        label: 'Client Secret',
        type: 'password',
        optional: true,
      },
      {
        name: 'root_folder_id',
        label: 'Root Folder ID',
        type: 'text',
        optional: true,
        placeholder: 'Leave empty for entire drive',
      },
    ],
    authRequired: true,
  },
  s3: {
    name: 'Amazon S3',
    icon: 'aws',
    fields: [
      {
        name: 'access_key_id',
        label: 'Access Key ID',
        type: 'text',
        required: true,
      },
      {
        name: 'secret_access_key',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
      },
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        options: [
          'us-east-1',
          'us-east-2',
          'us-west-1',
          'us-west-2',
          'eu-west-1',
          'eu-west-2',
          'eu-central-1',
          'ap-southeast-1',
          'ap-southeast-2',
          'ap-northeast-1',
        ],
        required: true,
      },
      { name: 'bucket', label: 'Bucket Name', type: 'text', optional: true },
      {
        name: 'endpoint',
        label: 'Custom Endpoint (optional)',
        type: 'text',
        optional: true,
        placeholder: 's3.amazonaws.com',
      },
    ],
  },
  dropbox: {
    name: 'Dropbox',
    icon: 'dropbox',
    fields: [
      { name: 'client_id', label: 'App Key', type: 'text', optional: true },
      {
        name: 'client_secret',
        label: 'App Secret',
        type: 'password',
        optional: true,
      },
    ],
    authRequired: true,
  },
  onedrive: {
    name: 'Microsoft OneDrive',
    icon: 'microsoft',
    fields: [
      { name: 'client_id', label: 'Client ID', type: 'text', optional: true },
      {
        name: 'client_secret',
        label: 'Client Secret',
        type: 'password',
        optional: true,
      },
    ],
    authRequired: true,
  },
  box: {
    name: 'Box',
    icon: 'box',
    fields: [
      { name: 'client_id', label: 'Client ID', type: 'text', optional: true },
      {
        name: 'client_secret',
        label: 'Client Secret',
        type: 'password',
        optional: true,
      },
    ],
    authRequired: true,
  },
  b2: {
    name: 'Backblaze B2',
    icon: 'b2',
    fields: [
      {
        name: 'account',
        label: 'Application Key ID',
        type: 'text',
        required: true,
      },
      {
        name: 'key',
        label: 'Application Key',
        type: 'password',
        required: true,
      },
      {
        name: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        optional: true,
      },
    ],
  },
  azureblob: {
    name: 'Azure Blob Storage',
    icon: 'azure',
    fields: [
      {
        name: 'account',
        label: 'Storage Account Name',
        type: 'text',
        required: true,
      },
      {
        name: 'key',
        label: 'Storage Account Key',
        type: 'password',
        required: true,
      },
      {
        name: 'sas_url',
        label: 'SAS URL (optional)',
        type: 'text',
        optional: true,
      },
      {
        name: 'container',
        label: 'Container Name',
        type: 'text',
        optional: true,
      },
    ],
  },
  pcloud: {
    name: 'pCloud',
    icon: 'pcloud',
    fields: [
      {
        name: 'username',
        label: 'Email',
        type: 'text',
        optional: true,
      },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        optional: true,
      },
    ],
    authRequired: true,
  },
  webdav: {
    name: 'WebDAV',
    icon: 'webdav',
    fields: [
      {
        name: 'url',
        label: 'WebDAV URL',
        type: 'text',
        required: true,
        placeholder: 'https://...',
      },
      { name: 'user', label: 'Username', type: 'text', optional: true },
      { name: 'pass', label: 'Password', type: 'password', optional: true },
      {
        name: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: ['owncloud', 'nextcloud', 'sharepoint', 'other'],
        optional: true,
      },
    ],
  },
  sftp: {
    name: 'SFTP',
    icon: 'server',
    fields: [
      { name: 'host', label: 'Host', type: 'text', required: true },
      { name: 'port', label: 'Port', type: 'number', default: 22 },
      { name: 'user', label: 'Username', type: 'text', required: true },
      { name: 'pass', label: 'Password', type: 'password', optional: true },
      {
        name: 'key_file',
        label: 'SSH Key File Path',
        type: 'text',
        optional: true,
      },
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
  name: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.pattern.base':
        'Name must only contain letters, numbers, underscores, and hyphens',
    }),
  type: Joi.string()
    .valid(...Object.keys(REMOTE_TYPES))
    .required(),
  config: Joi.object()
    .pattern(Joi.string().pattern(/^[a-zA-Z0-9_\-]+$/), Joi.string())
    .default({}),
});

const updateRemoteSchema = Joi.object({
  config: Joi.object()
    .pattern(Joi.string().pattern(/^[a-zA-Z0-9_\-]+$/), Joi.string())
    .required(),
});

const browseSchema = Joi.object({
  path: Joi.string()
    .required()
    .pattern(/^[\w\-:\/\.]+$/),
});

const testSchema = Joi.object({
  remote: Joi.string()
    .required()
    .pattern(/^[\w\-:\/\.]+$/)
    .max(200),
});

/**
 * GET /api/v1/remotes - List all remotes with their types
 */
router.get('/', async (_req, res) => {
  try {
    const remotes = await rcloneInstance.getRemotes();

    const enhancedRemotes = remotes.map((remote: any) => {
      const typeConfig = REMOTE_TYPES[remote.type as keyof typeof REMOTE_TYPES];
      return {
        ...remote,
        displayName: typeConfig?.name || remote.type,
        icon: typeConfig?.icon || 'cloud',
        configurable: !!typeConfig,
      };
    });

    sendSuccess(res, enhancedRemotes);
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
    const { stdout } = await RcloneRunner.run(['config', 'show', name], {
      timeoutMs: 10000,
    });

    // Parse the config output
    const lines = stdout.split('\n');
    const config: Record<string, string> = {};

    for (const line of lines) {
      if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        // Don't expose tokens or secrets
        if (
          key &&
          !key.includes('token') &&
          !key.includes('secret') &&
          !key.includes('pass')
        ) {
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
router.post(
  '/',
  validate(createRemoteSchema, 'body'),
  async (req, res, next) => {
    const { name, type, config } = req.body;

    try {
      // Check if remote already exists
      const { stdout: existing } = await RcloneRunner.run(['listremotes']);
      if (existing.includes(`${name}:`)) {
        throw new BadRequestError(`Remote "${name}" already exists`);
      }

      // Build rclone config create args
      const args: string[] = ['config', 'create', name, type];

      for (const [key, value] of Object.entries(config)) {
        if (value && typeof value === 'string' && value.trim()) {
          args.push(String(key), String(value));
        }
      }

      await RcloneRunner.run(args);

      logger.info('Created remote', { name, type });
      sendSuccess(
        res,
        { name, type, message: 'Remote created successfully' },
        201
      );
    } catch (e: any) {
      logger.error('Failed to create remote', { error: e.message });
      if (e instanceof BadRequestError) return next(e);
      next(new BadRequestError(e.message));
    }
  }
);

/**
 * PUT /api/v1/remotes/:name - Update remote configuration
 */
router.put(
  '/:name',
  validate(updateRemoteSchema, 'body'),
  async (req, res, next) => {
    const { name } = req.params;
    const { config } = req.body;

    try {
      // Update each config value
      for (const [key, value] of Object.entries(config)) {
        if (value !== '********') {
          // Don't update masked fields
          const valueStr = value === '' || value === null ? '' : String(value);
          await RcloneRunner.run(['config', 'update', name, key, valueStr]);
        }
      }

      logger.info('Updated remote', { name });
      sendSuccess(res, { name, message: 'Remote updated successfully' });
    } catch (e: any) {
      logger.error('Failed to update remote', { error: e.message });
      next(new BadRequestError(e.message));
    }
  }
);

/**
 * DELETE /api/v1/remotes/:name - Delete a remote
 */
router.delete('/:name', async (req, res, next) => {
  const { name } = req.params;

  try {
    await RcloneRunner.run(['config', 'delete', name]);
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
    await RcloneRunner.run([
      'lsd',
      remote,
      '--max-depth',
      '0',
      '--timeout',
      '15s',
    ]);
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
    const { stdout } = await RcloneRunner.run([
      'lsjson',
      remotePath,
      '--dirs-only',
      '--max-depth',
      '1',
      '--timeout',
      '30s',
    ]);
    const items = JSON.parse(stdout || '[]');

    const folders = items.map((item: any) => ({
      name: item.Name,
      path: `${remotePath}${remotePath.endsWith(':') ? '' : '/'}${item.Name}`,
      modTime: item.ModTime,
    }));

    sendSuccess(res, folders);
  } catch (e: any) {
    logger.error('Failed to browse remote', {
      path: remotePath,
      error: e.message,
    });
    sendSuccess(res, []);
  }
});

let rcloneInstance: any;

// Factory function to create the router (consistent with other routes)
export function createRemotesRouter(rclone: any): Router {
  rcloneInstance = rclone;
  return router;
}

export { router as remotesRouter };
export default createRemotesRouter;
