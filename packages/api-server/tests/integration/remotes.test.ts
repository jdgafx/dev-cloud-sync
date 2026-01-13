import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import { createRemotesRouter } from '../../src/routes/remotes.routes';
import { RcloneRunner } from '@dev-cloud-sync/shared';

jest.mock('@dev-cloud-sync/shared', () => ({
  RcloneRunner: {
    run: jest.fn(),
    isConnected: jest.fn(),
  },
}));

const mockRcloneService = {
  getRemotes: jest.fn(),
};

describe('Remotes Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(bodyParser.json());
    app.use('/api/v1/remotes', createRemotesRouter(mockRcloneService as any));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/remotes', () => {
    it('should return remotes with connected boolean', async () => {
      mockRcloneService.getRemotes.mockResolvedValue([
        { name: 'drive', type: 'drive' },
        { name: 'local', type: 'local' },
      ]);

      (RcloneRunner.isConnected as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const response = await request(app).get('/api/v1/remotes');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        name: 'drive',
        connected: true,
      });
      expect(response.body.data[1]).toMatchObject({
        name: 'local',
        connected: false,
      });
    });
  });

  describe('POST /api/v1/remotes', () => {
    it('should create a remote correctly', async () => {
      (RcloneRunner.run as jest.Mock).mockResolvedValueOnce({ stdout: '' });
      (RcloneRunner.run as jest.Mock).mockResolvedValueOnce({ stdout: '' });

      const response = await request(app)
        .post('/api/v1/remotes')
        .send({
          name: 'newremote',
          type: 'drive',
          config: { client_id: '123' },
        });

      expect(response.status).toBe(201);
      expect(RcloneRunner.run).toHaveBeenCalledTimes(2);
    });

    it('should fail if remote already exists', async () => {
      (RcloneRunner.run as jest.Mock).mockResolvedValueOnce({
        stdout: 'newremote:',
      });

      const response = await request(app)
        .post('/api/v1/remotes')
        .send({
          name: 'newremote',
          type: 'drive',
          config: { client_id: '123' },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/remotes/test', () => {
    it('should return success if remote is reachable', async () => {
      (RcloneRunner.run as jest.Mock).mockResolvedValue({ stdout: '' });

      const response = await request(app).post('/api/v1/remotes/test').send({
        remote: 'drive',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(true);
    });

    it('should return failure if remote is unreachable', async () => {
      (RcloneRunner.run as jest.Mock).mockRejectedValue(
        new Error('Connection failed')
      );

      const response = await request(app).post('/api/v1/remotes/test').send({
        remote: 'drive',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(false);
    });
  });
});
