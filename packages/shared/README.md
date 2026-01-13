# @dev-cloud-sync/shared

Shared utilities, core types, and validation schemas for the dev-cloud-sync platform.

## Description

The `shared` package provides a centralized location for code that is used across multiple packages in the dev-cloud-sync monorepo. By sharing types, schemas, and utilities, we ensure consistency and reduce code duplication between the `api-server`, `sync-engine`, and other potential clients.

## Key Features

- **Core Type Definitions**: Centralized TypeScript interfaces and types for the entire platform.
- **Zod Schemas**: Runtime data validation using Zod for API requests and configuration files.
- **Error Classes**: Custom error classes for consistent error handling and reporting.
- **Utilities**: General-purpose helper functions for common tasks like UUID generation and date formatting.
- **Constants**: Shared constants and configuration defaults.

## Directory Structure

```text
src/
├── types/         # Domain-specific TypeScript type definitions
├── utils.ts       # Common helper functions and utilities
├── validation.ts  # Zod schemas for data validation
├── errors.ts      # Custom error classes for the platform
├── constants.ts   # Shared constants and default values
└── index.ts       # Main entry point exporting all shared members
```

## Installation & Usage

This package is intended for use within the dev-cloud-sync monorepo.

### Installation

```bash
npm install @dev-cloud-sync/shared
```

### Usage

```typescript
import { SyncJob, syncJobSchema } from '@dev-cloud-sync/shared';

// Use a shared type
const myJob: SyncJob = {
  id: 'uuid',
  status: 'pending',
  // ...
};

// Use a Zod schema for validation
const result = syncJobSchema.safeParse(data);
if (!result.success) {
  // handle error
}
```

## Scripts

- `npm run build`: Compile TypeScript to JavaScript.
- `npm run test`: Run unit tests using Jest.
- `npm run lint`: Lint the codebase.
- `npm run format`: Format the code using Prettier.
