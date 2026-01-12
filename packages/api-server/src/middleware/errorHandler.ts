import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { sendError } from '../utils/response';
import logger from '../utils/logger';
import config from '../config';

/**
 * Global error handler middleware.
 * - Logs all errors with context
 * - Returns standardized error responses
 * - Never exposes stack traces in production
 */
export const errorHandler: ErrorRequestHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Extract request context for logging
    const requestId = (req as any).id || 'unknown';
    const context = {
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    };

    // Determine if this is an operational error we can handle gracefully
    const isOperational = err instanceof AppError && err.isOperational;

    // Log the error
    if (isOperational) {
        logger.warn('Operational error', { ...context, error: err.message, code: (err as AppError).code });
    } else {
        // Programming error - log full stack
        logger.error('Unhandled error', { ...context, error: err.message, stack: err.stack });
    }

    // Handle validation errors with details
    if (err instanceof ValidationError) {
        sendError(res, err.code, err.message, err.statusCode, err.details);
        return;
    }

    // Handle known operational errors
    if (err instanceof AppError) {
        sendError(res, err.code, err.message, err.statusCode);
        return;
    }

    // Handle unknown errors - don't expose internals in production
    const statusCode = 500;
    const message = config.isProd ? 'Internal Server Error' : err.message;
    const code = 'INTERNAL_ERROR';

    sendError(res, code, message, statusCode, config.isDev ? { stack: err.stack } : undefined);
};

/**
 * Handle 404 for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);
};
