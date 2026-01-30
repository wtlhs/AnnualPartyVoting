# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Annual Party Voting (年会最佳服装评选) is an H5 mobile web application for voting at annual parties. Users can register participants, scan QR codes to vote, and view real-time rankings. The application supports both LAN and HTTPS deployment modes.

## Development Commands

```bash
# Development
npm run dev              # Start development server with auto-reload (nodemon)

# Production
npm start                # Start HTTP server on port 3000
npm run start:lan        # Start LAN-accessible server
npm run start:https      # Start HTTPS server
npm run start:prod       # Start production server

# Building / Type Checking
npm run build            # Compile TypeScript
npm run build:watch      # Watch mode for TypeScript compilation
npm run type-check       # Type check without emitting files

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:types       # Run type checks (alias for type-check)

# Deployment
npm run deploy           # Install and start production server
npm run deploy:lan       # Deploy for LAN access
npm run deploy:https     # Generate SSL certs and start HTTPS server
npm run generate-ssl     # Generate self-signed SSL certificates
```

## Architecture

### Database Layer (`src/database/`)

- **init.js** - Database initialization, connection management, and schema creation
- **operations.js** - Core database operations (users, votes, restrictions, statistics)
- **VotingSettingsManager.js** - Manages voting settings (enable/disable, time limits) with 5-minute cache
- **VoteRecordManager.js** - Vote record management with filtering and status tracking
- **DataExportManager.js** - CSV/Excel export functionality with async task tracking
- **AuditLogManager.js** - Operation logging for admin actions
- **migrationRunner.js** - Database migration system with version tracking
- **migrations/** - Database schema migrations (001-005)

Key tables: `users`, `votes`, `vote_records`, `audit_logs`, `export_tasks`, `voting_settings`, `migrations`

### Route Layer (`src/routes/`)

- **users.js** - User registration, QR code generation, profile management
- **votes.js** - Voting operations, statistics, rankings, real-time progress (30s in-memory cache)
- **admin.js** - Admin panel, user management, vote record management, data export
- **voting-settings.js** - Admin settings for voting enable/disable, time restrictions
- **pages.js** - Static HTML page serving

### Middleware (`src/middleware/`)

- **adminAuth.js** - Admin authentication using password from environment variables

### Utilities (`src/utils/`)

- **qrcode.js** - QR code generation and scanning
- **fileManager.js** - File upload/download management
- **exportCleanupService.js** - Periodic cleanup of exported data files

### Frontend (`public/`)

Static HTML pages for:
- `index.html` - Main landing page
- `vote.html` - Voting page
- `scan.html` - QR code scanner
- `admin.html` - Admin dashboard
- `ranking-display.html` - Real-time ranking display
- `profile.html`, `user-list.html`, `vote-records.html`, `mobile-stats.html`

## Key Patterns

### Database Operations

- Always use `getDatabase()` from `src/database/init.js` to get a database connection
- The connection is NOT automatically closed - close it manually with `db.close()` when done
- Use migrations in `src/database/migrations/` for schema changes
- Numeric IDs are auto-generated 6-digit codes with retry logic for uniqueness

### Voting Flow

1. User registers via `/api/users` → gets UUID and numeric_id
2. QR code generated with `https://domain/vote.html?code=<numeric_id>`
3. Other users scan QR code → redirected to vote page
4. Vote submitted to `/api/votes` → checked against restrictions
5. Vote restrictions: max 3 votes per gender, cannot vote for self

### Caching Strategy

- **Vote statistics/ranking**: 30-second in-memory cache in `src/routes/votes.js`
- **Voting settings**: 5-minute cache in `VotingSettingsManager.js`
- Cache is invalidated on write operations

### Rate Limiting

- General: 500 requests per 15 minutes per IP
- Voting API: 50 requests per 5 minutes per IP
- Display/read-only APIs (statistics, ranking): 100 requests per minute
- Static files: No rate limiting

## Environment Configuration

- `PORT` - Server port (default: 3000)
- `ADMIN_PASSWORD_HASH` - Hashed admin password for authentication
- `NODE_ENV` - Set to 'production' for production CORS settings

## Testing

- Tests are located alongside source files with `.test.js` suffix
- Jest is configured to handle both JS and TS files
- Type definitions in `types/` directory are included in TypeScript compilation
- Test timeout is 10 seconds (configured in jest.config.js)

## Deployment Notes

- Data directory: `data/voting.db` (SQLite database)
- Uploads directory: `uploads/` (user avatars)
- Exports directory: `exports/` (data export files)
- Static files: `public/static/`
- Docker support: Uses node:18-alpine with sqlite3 native dependencies
- The application includes protocol detection middleware to handle HTTPS-to-HTTP redirect issues on LAN
