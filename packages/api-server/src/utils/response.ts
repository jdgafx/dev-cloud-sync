import { Response } from 'express';

/**
 * Standardized API response envelope.
 * All responses follow the { data, error, meta } structure.
 */

export interface ApiMeta {
    page?: number;
    perPage?: number;
    total?: number;
    hasMore?: boolean;
    requestId?: string;
    timestamp?: string;
}

export interface ApiResponse<T = unknown> {
    data: T | null;
    error: { code: string; message: string; details?: unknown } | null;
    meta?: ApiMeta;
}

/**
 * Send a successful response with data
 */
export function sendSuccess<T>(
    res: Response,
    data: T,
    statusCode = 200,
    meta?: ApiMeta
): void {
    const response: ApiResponse<T> = {
        data,
        error: null,
        meta: {
            ...meta,
            timestamp: new Date().toISOString(),
        },
    };
    res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
    res: Response,
    code: string,
    message: string,
    statusCode = 500,
    details?: unknown
): void {
    const response: ApiResponse<null> = {
        data: null,
        error: {
            code,
            message,
            details: details ?? undefined,
        },
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
    res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
    res: Response,
    data: T[],
    pagination: { page: number; perPage: number; total: number }
): void {
    const response: ApiResponse<T[]> = {
        data,
        error: null,
        meta: {
            page: pagination.page,
            perPage: pagination.perPage,
            total: pagination.total,
            hasMore: pagination.page * pagination.perPage < pagination.total,
            timestamp: new Date().toISOString(),
        },
    };
    res.status(200).json(response);
}
