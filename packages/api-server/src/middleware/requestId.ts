import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
    namespace Express {
        interface Request {
            id: string;
        }
    }
}

/**
 * Middleware to attach a unique request ID to each request.
 * Used for correlation across logs and debugging.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Use existing header if provided, otherwise generate
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
};
