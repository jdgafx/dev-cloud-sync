/**
 * Custom error classes for operational errors.
 * All errors extend AppError for consistent handling.
 */

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, code: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true; // Distinguishes from programming errors

        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

// 400 Bad Request
export class BadRequestError extends AppError {
    constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
        super(message, 400, code);
    }
}

// 400 Validation Error
export class ValidationError extends AppError {
    public readonly details: Record<string, string>[];

    constructor(message = 'Validation Failed', details: Record<string, string>[] = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        super(message, 401, code);
    }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', code = 'FORBIDDEN') {
        super(message, 403, code);
    }
}

// 404 Not Found
export class NotFoundError extends AppError {
    constructor(resource = 'Resource', code = 'NOT_FOUND') {
        super(`${resource} not found`, 404, code);
    }
}

// 409 Conflict
export class ConflictError extends AppError {
    constructor(message = 'Conflict', code = 'CONFLICT') {
        super(message, 409, code);
    }
}

// 500 Internal Server Error
export class InternalError extends AppError {
    constructor(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
        super(message, 500, code);
    }
}

// 503 Service Unavailable
export class ServiceUnavailableError extends AppError {
    constructor(message = 'Service Unavailable', code = 'SERVICE_UNAVAILABLE') {
        super(message, 503, code);
    }
}
