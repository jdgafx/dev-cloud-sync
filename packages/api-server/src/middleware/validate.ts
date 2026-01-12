import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validation middleware factory.
 * Wraps Joi schemas and throws ValidationError with field-level details.
 */
export function validate(schema: Joi.Schema, source: RequestPart = 'body') {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const data = req[source];

        const { error, value } = schema.validate(data, {
            abortEarly: false, // Collect all errors
            stripUnknown: true, // Remove unknown fields
            convert: true, // Type coercion
        });

        if (error) {
            const details = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/"/g, ''),
            }));

            throw new ValidationError('Validation failed', details);
        }

        // Replace with validated & sanitized data
        req[source] = value;
        next();
    };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
    id: Joi.string().required(),
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        perPage: Joi.number().integer().min(1).max(100).default(20),
    }),
};
