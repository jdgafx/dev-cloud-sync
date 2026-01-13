import express from 'express';
import { createServer } from 'http';
import net from 'net';
import { execSync } from 'child_process';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import config, { validateConfig } from './config';
import logger from './utils/logger';
import { RcloneService } from './services/rclone.service';
import { createApiRouter } from './routes';
import healthRoutes from './routes/health.routes';
import { initializeDatabase } from './db/init';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';

// === STARTUP VALIDATION ===
validateConfig();

// Initialize Database - Exit on critical errors
initializeDatabase()
  .then(() => {
    logger.info('Database initialized successfully');
    // Continue with server startup only after successful DB init
    startServer();
  })
  .catch((err) => {
    logger.error('Critical: Database initialization failed', {
      error: err.message,
    });
    logger.error('Server cannot start without database. Exiting.');
    process.exit(1);
  });

export const app = express();
export const httpServer = createServer(app);
export const rclone = new RcloneService();

// === SOCKET.IO ===
export const io = new Server(httpServer, {
  cors: {
    origin: config.isDev ? '*' : config.cors.origins,
    methods: ['GET', 'POST'],
  },
});

async function getAvailablePort(
  start: number,
  step: number = 5
): Promise<number> {
  const tryPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
    });
  };

  let port = start;
  while (port < 65535) {
    if (await tryPort(port)) return port;
    port += step;
  }
  throw new Error('No available ports found.');
}

async function startServer() {
  // === MIDDLEWARE STACK ===

  // Request ID for correlation
  app.use(requestIdMiddleware);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS - configured per environment
  app.use(
    cors({
      origin: config.isDev ? '*' : config.cors.origins,
      credentials: config.cors.credentials,
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimiting.windowMs,
    max: config.rateLimiting.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      data: null,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    },
  });
  app.use('/api', limiter);

  // Body parsing & compression
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Forward RcloneService events to Socket.IO clients
  rclone.on('jobs:update', (jobs) => {
    io.emit('jobs:update', jobs);
  });

  rclone.on('activity:log', (entry) => {
    io.emit('activity:log', entry);
  });

  rclone.on('activity:cleared', () => {
    io.emit('activity:cleared');
  });

  // Broadcast stats periodically
  const statsInterval = setInterval(async () => {
    const stats = await rclone.getStats();
    io.emit('stats:update', stats);

    // Update systemd status dynamically if running as a service
    if (process.env.NOTIFY_SOCKET) {
      try {
        const port = config.server.port;
        const active = stats.activeJobs;
        let speedStr = '0.0 MB/s';
        if (stats.speed > 1073741824) {
          speedStr = `${(stats.speed / 1073741824).toFixed(2)} GB/s`;
        } else if (stats.speed > 1048576) {
          speedStr = `${(stats.speed / 1048576).toFixed(1)} MB/s`;
        } else {
          speedStr = `${(stats.speed / 1024).toFixed(0)} KB/s`;
        }
        const status = `READY=1\nSTATUS=Running on port ${port} | Threads: ${active} | Bandwidth: ${speedStr}`;
        execSync(`systemd-notify "${status}"`, { stdio: 'ignore' });
      } catch (e) {
        // Silently skip if notify fails
      }
    }
  }, config.rclone.statsIntervalMs);

  io.on('connection', (socket) => {
    logger.debug('Client connected', { socketId: socket.id });

    // Send initial data
    socket.emit('jobs:update', rclone.getJobs());
    rclone.getStats().then((stats) => socket.emit('stats:update', stats));
    socket.emit('activity:history', rclone.getActivityLog(100));

    socket.on('disconnect', () => {
      logger.debug('Client disconnected', { socketId: socket.id });
    });
  });

  // === ROUTES ===

  // Health checks (outside /api for load balancers)
  app.use(healthRoutes);

  // API v1 routes
  app.use('/api/v1', createApiRouter(rclone, io));

  // Legacy routes (redirect to v1 for backward compatibility)
  app.use('/api', (req, res, next) => {
    // Only redirect if not already under v1
    if (!req.path.startsWith('/v1')) {
      return res.redirect(307, `/api/v1${req.path}`);
    }
    next();
  });

  // === STATIC FILES ===
  const webDistPath = config.paths.webDist;
  if (fs.existsSync(webDistPath)) {
    logger.info(`Serving static files from: ${webDistPath}`);
    app.use(express.static(webDistPath));

    // Use a regex route to safely match all non-/api and non-/socket.io paths
    // This avoids issues with some path-to-regexp versions handling '*' differently
    app.get(/^\/(?!api|socket\.io).*/, (req, res) => {
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  }

  // === ERROR HANDLING ===
  app.use(notFoundHandler);
  app.use(errorHandler);

  // === GRACEFUL SHUTDOWN ===
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new connections
    httpServer.close(async () => {
      logger.info('HTTP server closed');

      // Cleanup resources
      clearInterval(statsInterval);
      await rclone.shutdown();

      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force exit after 30s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  process.on('SIGTERM', () => {
    try {
      execSync('systemd-notify --status="Stopping server..."');
    } catch (e) {}
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    try {
      execSync('systemd-notify --status="Stopping server (SIGINT)..."');
    } catch (e) {}
    shutdown('SIGINT');
  });

  // === START SERVER ===
  const desiredPort = config.server.port;
  const port = await getAvailablePort(desiredPort, 5);

  httpServer.listen(port, () => {
    logger.info(`🚀 CloudSync API Server running`, {
      port,
      env: config.env,
      apiVersion: 'v1',
    });
    logger.info(`📡 WebSocket server ready`);
    logger.info(`📂 Jobs stored in: ${config.paths.jobsFile}`);

    // Notify systemd that service is ready
    if (process.env.NOTIFY_SOCKET) {
      try {
        const status = `READY=1\nSTATUS=Running on port ${port} (${config.env})`;
        execSync(`systemd-notify "${status}"`, { stdio: 'ignore' });
      } catch (e) {
        logger.debug('Systemd notification failed (skipping)', {
          error: (e as Error).message,
        });
      }
    }
  });
}
