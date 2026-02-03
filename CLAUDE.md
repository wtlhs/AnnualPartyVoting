# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ IMPORTANT: Documentation Maintenance Rule

**EVERY TIME you make code changes to this repository, you MUST update this file to reflect the new code logic.**

- Keep this documentation synchronized with the actual codebase
- Update architecture descriptions when adding/removing files
- Document new patterns, functions, or workflows as they are introduced
- Remove outdated information when features are deprecated
- This ensures future Claude Code instances can work productively without confusion

## Project Overview

Annual Party Voting (年会最佳服装评选) is an H5 mobile web application for voting at annual parties. Users can register participants, scan QR codes to vote, and view real-time rankings. The application supports both LAN and HTTPS deployment modes with SQLite database persistence.

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

**Core Database Files:**
- **init.js** - Database initialization, connection management, and schema creation. Runs legacy migrations then new migration system on startup. Database file: `data/voting.db`
- **operations.js** - Core database operations with ~1400 lines covering:
  - User CRUD (create, read, update, delete, numeric ID generation with retry logic)
  - Voting operations (atomicVote for concurrent safety, recordVote)
  - Vote restrictions (each voter can vote once per gender: male/female)
  - Statistics, rankings, recent votes, voting progress
  - Data management (clearAllData, createDataBackup, archiveAndClearData, getDatabaseInfo)

**Manager Classes:**
- **VotingSettingsManager.js** - Manages voting settings with 5-minute in-memory cache:
  - `voting_enabled` - Enable/disable voting
  - `voting_start_time` / `voting_end_time` - Time restrictions
  - `voting_message` - Custom message when voting disabled
  - `max_votes_per_user` - Max votes per user (default: 2)
  - `allow_self_vote` - Allow self-voting (default: false)

- **VoteRecordManager.js** - Vote record management with filtering (status, voter, candidate, date range, vote method), pagination, and status tracking

- **DataExportManager.js** - CSV/Excel export functionality with async task tracking

- **AuditLogManager.js** - Operation logging for admin actions with IP address, user agent tracking

**Migration System:**
- **migrationRunner.js** - Database migration system with version tracking and `migrations` table
- **migrations/** - Schema migration files (001-005):
  - 001: Extend votes table with status, user_agent, vote_method
  - 002: Create audit_logs table
  - 003: Create export_tasks table for async export jobs
  - 004: Create voting_settings table
  - 005: Update audit_logs for system operations

**Database Schema:**
- `users` - id (UUID), numeric_id (6-digit, unique), name, gender, avatar_url, qr_code, timestamps
- `votes` - id, voter_id, target_user_id, vote_time, ip_address, status, user_agent, vote_method
- `vote_restrictions` - voter_id (unique), male_voted_user_id, female_voted_user_id, timestamps
- `audit_logs` - id, vote_id, admin_id, operation, reason, metadata (JSON), created_at
- `export_tasks` - id, task_type, status, filters, file_path, created_by, timestamps
- `voting_settings` - setting_key (unique), setting_value, description, updated_at
- `migrations` - id, filename, description, applied_at

### Route Layer (`src/routes/`)

- **users.js** - User registration (generates UUID + 6-digit numeric ID with collision retry), QR code generation, profile management, avatar upload
- **votes.js** - Voting operations with 30-second in-memory cache for statistics/ranking. Checks voting status, self-vote restrictions, gender-based vote limits (1 male + 1 female per voter)
- **admin.js** - Admin panel with authentication, user management, vote record management with filtering, data export (CSV/Excel), database operations
- **voting-settings.js** - Admin settings for voting enable/disable, time restrictions, custom messages
- **pages.js** - Static HTML page serving

### Middleware (`src/middleware/`)

- **adminAuth.js** - Admin authentication using `ADMIN_PASSWORD_HASH` environment variable (bcrypt hashed)

### Utilities (`src/utils/`)

- **qrcode.js** - QR code generation using `qrcode` library
- **fileManager.js** - File upload/download management, avatar backup and cleanup
- **exportCleanupService.js** - Periodic cleanup of exported data files (runs on startup)

### Frontend (`public/`)

Static HTML pages with responsive mobile-first design:
- `index.html` - Main landing page with registration
- `vote.html` - Voting page with gender selection
- `scan.html` - QR code scanner (camera-based)
- `admin.html` - Admin dashboard with authentication
- `ranking-display.html` - Real-time ranking display (auto-refresh)
- `profile.html`, `user-list.html`, `vote-records.html`, `mobile-stats.html`

## Key Patterns

### Database Operations

- **Connection Pattern**: Always use `getDatabase()` from `src/database/init.js` to get a database connection
- **Connection Management**: Connections are NOT automatically closed - close them manually with `db.close()` when done
- **Numeric ID Generation**: 6-digit random IDs with 10-attempt retry logic for uniqueness (operations.js:50-101)
- **Legacy Migration System**: Checks for `numeric_id` column using `PRAGMA table_info()` and adds it if missing (init.js:136-190)

### Voting Flow

1. User registers via `/api/users` → gets UUID (v4) and numeric_id (6 digits)
2. QR code generated with URL: `https://domain/vote.html?code=<numeric_id>`
3. Other users scan QR code → redirected to vote page
4. Vote submitted to `/api/votes` → validated against restrictions:
   - Check `votingSettings.getVotingStatus()` for enabled/time restrictions
   - Check voter != target (no self-voting)
   - Check gender-based restriction via `canVoteForGender()` (max 1 male + 1 female per voter)
5. Use `atomicVote()` for concurrent-safe voting with transactions (operations.js:570-723)
6. Cache invalidated on write operations

### Caching Strategy

- **Vote Statistics/Ranking**: 30-second in-memory cache in `src/routes/votes.js:20-38`
  - Cache stores: `statistics`, `ranking`, `lastUpdate`, `ttl: 30000`
  - Cleared on: vote operations, settings changes
- **Voting Settings**: 5-minute cache in `VotingSettingsManager.js:13-15`
  - `settingsCache` Map with `cacheExpiry: 5 * 60 * 1000`
  - Cleared on: settings updates, refreshed via `refreshCache()`

### Rate Limiting (server.js)

- **General**: 500 requests per 15 minutes per IP
- **Voting API**: 50 requests per 5 minutes per IP
- **Display/Read APIs** (statistics, ranking): 100 requests per minute
- **Static Files**: No rate limiting

### Security & LAN Support

- **Helmet.js**: Configured for LAN access with disabled HSTS, COOP, CORP
- **Protocol Detection Middleware** (server.js:54-66): Detects HTTPS requests to HTTP server and redirects to protocol fix page
- **CORS**: Enabled based on `NODE_ENV` (production allows specific origins)

### Testing

- **Framework**: Jest with ts-jest for TypeScript
- **Test Location**: Alongside source files with `.test.js` suffix (e.g., `adminAuth.test.js`)
- **Coverage**: Run with `npm run test:coverage` - excludes `.d.ts` and test files
- **Timeout**: 10 seconds configured in jest.config.js

## Environment Configuration

- `PORT` - Server port (default: 3000)
- `ADMIN_PASSWORD_HASH` - Hashed admin password for authentication (bcrypt)
- `NODE_ENV` - Set to 'production' for production CORS settings

## Directory Structure

```
AnnualPartyVoting/
├── data/                      # Database directory (auto-created)
│   └── voting.db             # SQLite database file
├── exports/                   # Exported data files
├── uploads/                   # User avatar uploads
├── public/                    # Static frontend files
│   ├── index.html            # Landing page
│   ├── vote.html             # Voting page
│   ├── admin.html            # Admin dashboard
│   └── ...
├── src/
│   ├── database/
│   │   ├── init.js           # Database initialization
│   │   ├── operations.js     # Core DB operations (~1400 lines)
│   │   ├── VotingSettingsManager.js
│   │   ├── VoteRecordManager.js
│   │   ├── DataExportManager.js
│   │   ├── AuditLogManager.js
│   │   ├── migrationRunner.js
│   │   └── migrations/       # Migration files 001-005
│   ├── routes/
│   │   ├── users.js
│   │   ├── votes.js          # Vote API with 30s cache
│   │   ├── admin.js
│   │   ├── voting-settings.js
│   │   └── pages.js
│   ├── middleware/
│   │   └── adminAuth.js      # Admin authentication
│   └── utils/
│       ├── qrcode.js
│       ├── fileManager.js
│       └── exportCleanupService.js
├── server.js                  # Main HTTP server
├── server-lan.js             # LAN-accessible server
├── server-https.js           # HTTPS server
├── start-production.js       # Production starter
└── generate-ssl-fixed.js     # SSL cert generation
```

## Deployment Notes

- **Docker**: Uses `node:18-alpine` base image with sqlite3 native dependencies
- **Database**: SQLite with WAL mode enabled for better concurrency
- **File Persistence**: Database in `data/voting.db`, uploads in `uploads/`, exports in `exports/`
- **Protocol Handling**: Special middleware handles HTTPS-to-HTTP redirect issues on LAN access
- **Cleanup**: Export cleanup service runs on startup to remove old export files

## Data Integrity

- **Foreign Keys**: Enabled with `PRAGMA foreign_keys = ON`
- **Transactions**: Used in `atomicVote()` for concurrent voting safety
- **Indexes**: Created on voter_id, target_user_id, numeric_id for query performance
- **Migration Tracking**: All migrations tracked in `migrations` table to prevent re-runs
