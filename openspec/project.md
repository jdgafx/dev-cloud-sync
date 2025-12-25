# Project Context

## Purpose
Dev-Cloud-Sync is a universal cloud synchronization platform that provides seamless file and data synchronization across multiple devices, platforms, and cloud providers. The platform focuses on user privacy, security, and intuitive operation with offline-first capabilities and intelligent conflict resolution.

## Tech Stack
- **Backend**: Node.js with TypeScript, Express.js, Socket.IO
- **Database**: PostgreSQL (primary), Redis (caching/sessions)
- **Frontend**: React with TypeScript, Electron (desktop), React Native (mobile)
- **Cloud Storage**: Multi-provider support (AWS S3, Google Drive, Dropbox, OneDrive, self-hosted)
- **Real-time**: WebSockets, Server-Sent Events
- **Security**: AES-256-GCM encryption, RSA-4096 key management, OAuth2 + JWT
- **Testing**: Jest, Playwright, comprehensive test coverage
- **Deployment**: Docker, Kubernetes, universal bash scripts for Linux

## Project Conventions

### Code Style
- **TypeScript Strict Mode**: All files must use strict TypeScript
- **ESLint + Prettier**: Automated formatting and linting
- **Naming**: kebab-case for files/directories, PascalCase for classes, camelCase for variables
- **File Organization**: <500 lines per file, single responsibility principle
- **Comments**: JSDoc for public APIs, inline comments only for complex logic

### Architecture Patterns
- **Clean Architecture**: Separation of concerns with clear layer boundaries
- **Event-Driven**: Asynchronous message passing for real-time updates
- **Microservices**: Modular, independently deployable services
- **Repository Pattern**: Data access abstraction
- **Observer Pattern**: Real-time synchronization events
- **Strategy Pattern**: Multiple cloud provider implementations

### Testing Strategy
- **Test-Driven Development**: Write tests before implementation
- **90%+ Coverage**: Unit, integration, and E2E testing
- **Property-Based Testing**: For core synchronization logic
- **Load Testing**: Validate performance under high concurrency
- **Security Testing**: Penetration testing and vulnerability scanning

### Git Workflow
- **Main Branch**: `main` (always production-ready)
- **Feature Branches**: `feature/description`, `bugfix/description`
- **Commit Format**: Conventional Commits (`type: description`)
- **PR Requirements**: Tests, documentation, OpenSpec validation
- **Protected Branches**: Require reviews and status checks

## Domain Context

### Synchronization Concepts
- **Delta Sync**: Transfer only file differences
- **Conflict Resolution**: Three-way merge with user prompts
- **Offline Mode**: Local caching with background sync
- **Version Control**: File history with rollback capabilities
- **Selective Sync**: User-configurable file/folder inclusion

### Multi-Platform Support
- **Desktop**: Windows, macOS, Linux (Electron)
- **Mobile**: iOS, Android (React Native)
- **Web**: Progressive Web App (PWA)
- **Server**: Linux containers, cloud deployment

### Cloud Provider Integration
- **Standard APIs**: Use official SDKs and REST APIs
- **Authentication**: OAuth2 flows for each provider
- **Rate Limiting**: Respect provider API limits
- **Error Handling**: Graceful degradation for provider issues

## Important Constraints

### Security Requirements
- **Zero-Knowledge**: Provider cannot access user data
- **End-to-End Encryption**: Files encrypted before upload
- **Key Management**: User-controlled encryption keys
- **Compliance**: GDPR, SOC2, HIPAA-ready architecture

### Performance Targets
- **Sync Latency**: <500ms for files <10MB
- **Throughput**: 10,000+ concurrent users per region
- **Storage**: Petabyte-scale support
- **Bandwidth Efficiency**: Delta transfers, compression

### Compatibility Requirements
- **Linux Distributions**: Universal support across all major distros
- **Browser Support**: Modern browsers with 2-year support window
- **Mobile Versions**: iOS 12+, Android 8+
- **Network**: Work offline, sync on reconnect

## External Dependencies

### Cloud Storage APIs
- **AWS SDK**: S3, Glacier, CloudFront
- **Google APIs**: Drive, Cloud Storage
- **Microsoft Graph**: OneDrive, SharePoint
- **Dropbox API**: File storage and sharing

### Security Libraries
- **Node Forge**: Cryptography operations
- **JWT**: Token-based authentication
- **Passport**: Authentication strategies
- **Helmet**: Security headers and middleware

### Development Tools
- **TypeScript**: Static typing and compilation
- **Webpack**: Module bundling and optimization
- **Docker**: Containerization and deployment
- **Kubernetes**: Orchestration and scaling
