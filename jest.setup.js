// Jest setup file for global test configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/dev_cloud_sync_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.SESSION_SECRET = 'test-session-secret';

// Global test timeout for async operations
jest.setTimeout(10000);

// Suppress console logs during tests unless explicitly needed
if (process.env.VERBOSE_TESTS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Mock external services by default
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn(() => ({
      promise: jest.fn().mockResolvedValue({ Location: 'test-location' }),
    })),
    deleteObject: jest.fn(() => ({
      promise: jest.fn().mockResolvedValue({}),
    })),
  })),
}));

// Global test utilities
global.createTestUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  createdAt: new Date(),
  updatedAt: new Date(),
});

global.createTestFile = () => ({
  id: 'test-file-id',
  name: 'test-file.txt',
  size: 1024,
  mimeType: 'text/plain',
  userId: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
});