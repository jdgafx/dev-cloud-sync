module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@sync-engine/(.*)$': '<rootDir>/../sync-engine/src/$1',
    '^@api-server/(.*)$': '<rootDir>/src/$1',
    '^@database/(.*)$': '<rootDir>/../database/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)',
  ],
  verbose: true,
};
