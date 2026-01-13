/**
 * Core type definitions for the dev-cloud-sync platform
 */

import { z } from 'zod';

/**
 * Schema for a platform user.
 * Includes unique identifier, credentials, and account status.
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  hashedPassword: z.string().min(60),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({
  id: true,
  hashedPassword: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

/**
 * Schema for a file managed by the platform.
 * Contains metadata, size, checksum, and storage path.
 */
export const FileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  checksum: z.string().length(64), // SHA-256 hash
  path: z.string(),
  isDeleted: z.boolean().default(false),
  deletedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type File = z.infer<typeof FileSchema>;

export const CreateFileSchema = FileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateFile = z.infer<typeof CreateFileSchema>;

/**
 * Schema for a synchronization operation.
 * Tracks the movement, creation, update, or deletion of files across remotes.
 */
export const SyncOperationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fileId: z.string().uuid(),
  operation: z.enum(['create', 'update', 'delete', 'move']),
  sourcePath: z.string(),
  targetPath: z.string().optional(),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'failed'])
    .default('pending'),
  errorMessage: z.string().optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});

export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const CreateSyncOperationSchema = SyncOperationSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  completedAt: true,
  errorMessage: true,
});

export type CreateSyncOperation = z.infer<typeof CreateSyncOperationSchema>;

// API Response types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

export type ApiResponse<T = any> = z.infer<typeof ApiResponseSchema> & {
  data?: T;
};

export const PaginatedResponseSchema = z.object({
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number().positive(),
    limit: z.number().positive(),
    total: z.number().nonnegative(),
    totalPages: z.number().nonnegative(),
  }),
});

export type PaginatedResponse<T = any> = z.infer<
  typeof PaginatedResponseSchema
> & {
  data: T[];
};

// JWT Payload types
export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  username: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// Configuration types
export const DatabaseConfigSchema = z.object({
  host: z.string(),
  port: z.number().positive(),
  database: z.string(),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().default(false),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

export const RedisConfigSchema = z.object({
  host: z.string(),
  port: z.number().positive(),
  password: z.string().optional(),
  db: z.number().default(0),
});

export type RedisConfig = z.infer<typeof RedisConfigSchema>;

export const S3ConfigSchema = z.object({
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  region: z.string(),
  bucket: z.string(),
  endpoint: z.string().optional(),
});

export type S3Config = z.infer<typeof S3ConfigSchema>;
