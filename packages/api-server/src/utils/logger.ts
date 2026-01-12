import winston from 'winston';
import config from '../config';

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Custom format for development (human-readable)
const devFormat = printf(({ level, message, timestamp, requestId, ...meta }) => {
    const reqId = requestId ? `[${requestId}] ` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${reqId}${message}${metaStr}`;
});

// Production format: structured JSON
const prodFormat = combine(
    timestamp({ format: 'ISO' }),
    errors({ stack: true }),
    json()
);

// Development format: colorized, readable
const developmentFormat = combine(
    timestamp({ format: 'HH:mm:ss' }),
    colorize(),
    errors({ stack: true }),
    devFormat
);

const logger = winston.createLogger({
    level: config.logging.level,
    format: config.isProd ? prodFormat : developmentFormat,
    defaultMeta: { service: 'cloudsync-api' },
    transports: [
        new winston.transports.Console(),
    ],
});

// Add file transport in production
if (config.isProd) {
    logger.add(new winston.transports.File({ filename: 'error.log', level: 'error' }));
    logger.add(new winston.transports.File({ filename: 'combined.log' }));
}

// Create child logger with request context
export function createRequestLogger(requestId: string, userId?: string) {
    return logger.child({ requestId, userId });
}

export default logger;
