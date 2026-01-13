# @dev-cloud-sync/api-server

The central API server and WebSocket interface for the dev-cloud-sync platform.

## Description

The `api-server` package provides the backend infrastructure for the dev-cloud-sync platform. It exposes a RESTful API for management tasks and a WebSocket interface (Socket.IO) for real-time monitoring of synchronization progress and logs.

## Key Features

- **RESTful API**: Comprehensive endpoints for managing synchronization jobs, remotes, and users.
- **Real-time Updates**: Socket.IO integration for broadcasting live sync stats, logs, and job updates.
- **Database Integration**: PostgreSQL support for persistent storage of job history, configuration, and user data.
- **Security**: Built-in protection with Helmet, CORS, and rate limiting (Express Rate Limit).
- **Authentication**: JWT-based authentication for secure API access.
- **Swagger Documentation**: Interactive API documentation available via Swagger UI.
- **Graceful Shutdown**: Handles termination signals to ensure clean resource cleanup.

## Directory Structure

```text
src/
├── routes/       # API endpoint definitions (v1 and health)
├── services/     # Business logic layer (rclone service, db services)
├── db/           # Database models and initialization scripts
├── middleware/   # Express middleware (auth, error handling, etc.)
├── config/       # Server configuration and environment validation
├── utils/        # Server-specific utilities and logging
└── index.ts      # Application entry point and server setup
```

## Installation & Usage

### Prerequisites

- PostgreSQL database.
- Redis (optional, for advanced features).
- Environment variables configured in a `.env` file.

### Installation

```bash
npm install @dev-cloud-sync/api-server
```

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## API Documentation

Once the server is running, you can access the Swagger documentation at:
`http://localhost:<PORT>/api-docs` (Default port is usually 3000)

## Scripts

- `npm run build`: Build the project for production.
- `npm run dev`: Run the server with `ts-node` for development.
- `npm start`: Start the compiled production server.
- `npm run test`: Run tests using Supertest and Jest.
- `npm run lint`: Lint the codebase.
