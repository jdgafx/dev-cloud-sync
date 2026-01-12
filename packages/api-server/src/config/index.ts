import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const config = {
    env: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV !== 'production',
    isProd: process.env.NODE_ENV === 'production',

    server: {
        port: parseInt(process.env.PORT || '3005', 10),
        host: process.env.HOST || '0.0.0.0',
    },

    database: {
        url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5435/dev_cloud_sync',
    },

    cors: {
        // In production, specify exact origins
        origins: process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',')
            : ['http://localhost:3000', 'http://localhost:8888'],
        credentials: true,
    },

    rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
    },

    paths: {
        data: path.join(process.cwd(), 'data'),
        jobsFile: path.join(process.cwd(), 'data', 'jobs.json'),
        webDist: path.resolve(__dirname, '../../../../apps/web/dist'),
    },

    rclone: {
        timeout: parseInt(process.env.RCLONE_TIMEOUT || '300', 10), // 5 minutes
        schedulerIntervalMs: 60 * 1000, // 1 minute
        statsIntervalMs: 500, // 0.5 seconds for hyper-responsive telemetry
    },

    logging: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    },
} as const;

// Validate required config on startup
export function validateConfig(): void {
    const required: string[] = []; // Add required env vars here if needed
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

export default config;
