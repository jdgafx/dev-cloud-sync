---
description: Backend development principles for robust, scalable Node.js/Express APIs
---

# Backend Development Standards

## 1. ARCHITECTURAL PRINCIPLES

### API Design
- **RESTful conventions**: Use proper HTTP verbs (GET, POST, PUT, PATCH, DELETE) with semantic URLs
- **Consistent response structure**: Always return `{ data, error, meta }` envelopes
- **Versioning**: Prefix routes with `/api/v1/` for future compatibility
- **Pagination**: Use cursor-based or offset pagination for list endpoints
- **Rate limiting**: Protect endpoints with configurable throttling

### Project Structure
```
src/
├── routes/          # Express route handlers (thin controllers)
├── services/        # Business logic layer
├── models/          # Data models/schemas
├── middleware/      # Auth, validation, error handling
├── utils/           # Shared utilities
├── config/          # Environment-based configuration
└── index.ts         # Entry point
```

## 2. CODE STANDARDS

### Error Handling
- **Global error handler**: Centralize all error responses through middleware
- **Custom error classes**: Extend `Error` with `statusCode`, `code`, and `isOperational` properties
- **Never expose stack traces** in production responses
- **Log all errors** with structured context (request ID, user ID, timestamp)

### Validation
- Use **Zod** or **Joi** for request validation at the route level
- Validate early, fail fast
- Return descriptive validation error messages with field paths

### Security
- **Helmet.js**: Enable with sensible defaults
- **CORS**: Explicitly whitelist allowed origins in production
- **Input sanitization**: Escape and validate all user input
- **Environment variables**: Never commit secrets; use `.env` with validation
- **Rate limiting**: Apply per-IP and per-user limits

## 3. DATABASE PATTERNS

### Query Optimization
- Index frequently queried fields
- Use connection pooling (e.g., `pg-pool`, `mongoose` connection limits)
- Implement **read replicas** for heavy read loads
- Log slow queries in development

### Transaction Safety
- Wrap multi-step operations in transactions
- Use optimistic locking where appropriate
- Handle deadlocks gracefully with retry logic

## 4. REAL-TIME (Socket.IO / WebSockets)

- **Namespace isolation**: Separate concerns into different namespaces
- **Room-based broadcasting**: Avoid global broadcasts; scope to relevant clients
- **Heartbeat/keep-alive**: Detect stale connections early
- **Reconnection strategy**: Implement exponential backoff on client

## 5. LOGGING & MONITORING

### Structured Logging
- Use **Pino** or **Winston** with JSON output
- Include: `timestamp`, `level`, `message`, `requestId`, `userId`, `context`
- Log at appropriate levels: `error`, `warn`, `info`, `debug`

### Observability
- **Health endpoints**: `/health` (liveness) and `/ready` (readiness)
- **Metrics**: Track request latency, error rates, queue depths
- **Tracing**: Use correlation IDs across service boundaries

## 6. TESTING STRATEGY

### Test Pyramid
- **Unit tests**: Services and utilities (80%)
- **Integration tests**: API routes with test database (15%)
- **E2E tests**: Critical user flows only (5%)

### Test Commands
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## 7. DEPLOYMENT CHECKLIST

- [ ] Environment variables validated on startup
- [ ] Graceful shutdown handling (SIGTERM, SIGINT)
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] Logs shipping to aggregator
- [ ] Secrets in vault/secrets manager
- [ ] Rate limiting configured
- [ ] CORS configured for production origins

## 8. COMMON PATTERNS

### Service Layer Example
```typescript
// services/job.service.ts
export class JobService {
  constructor(private readonly db: Database) {}

  async createJob(data: CreateJobDto): Promise<Job> {
    const validated = createJobSchema.parse(data);
    const job = await this.db.jobs.create(validated);
    await this.emitEvent('job:created', job);
    return job;
  }
}
```

### Global Error Handler
```typescript
// middleware/error.handler.ts
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';
  
  logger.error({ err, requestId: req.id, path: req.path });
  
  res.status(statusCode).json({
    error: { code: err.code || 'INTERNAL_ERROR', message },
    data: null,
  });
};
```

## 9. WHEN TO APPLY

Use this workflow when:
- Building or modifying Express/Node.js API endpoints
- Designing new services or database schemas
- Adding real-time features with Socket.IO
- Troubleshooting API errors or performance issues
- Writing backend tests

---

**Remember**: Clean, predictable APIs enable clean UIs. The backend exists to serve the frontend with reliable, well-documented data.
