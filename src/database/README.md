# Database Operations

This module provides comprehensive database operation utilities for the annual party voting system.

## Files

- `init.js` - Database initialization and connection management
- `operations.js` - Core database operation functions
- `operations.test.js` - Unit tests for database operations
- `integration.test.js` - Integration tests for complete workflows

## Core Functions

### User Operations

- `createUser(userData)` - Create a new user with validation
- `getUserById(userId)` - Get user by ID with vote count
- `updateUser(userId, updateData)` - Update user information
- `deleteUser(userId)` - Delete user and related data
- `getAllUsers()` - Get all users with vote counts

### Voting Operations

- `recordVote(voteData)` - Record a vote for a participant
- `getVoteStatistics()` - Get comprehensive voting statistics
- `getRanking(gender)` - Get ranking by gender with vote counts
- `getVotesForUser(targetUserId)` - Get all votes for a specific user

### Vote Restriction Operations

- `checkVoteRestrictions(voterId)` - Check current voting restrictions
- `updateVoteRestrictions(voterId, targetUserId, targetGender)` - Update restrictions after vote
- `canVoteForGender(voterId, targetGender)` - Check if voter can vote for gender
- `clearAllVoteRestrictions()` - Admin function to clear all restrictions
- `clearAllData()` - Admin function to clear all data

## Key Features

### Data Validation
- Name validation (non-empty, trimmed)
- Gender validation (male/female only)
- File format validation for avatars
- Input sanitization and error handling

### Vote Restrictions
- One vote per gender per voter
- Automatic restriction tracking
- Comprehensive restriction status queries
- Prevention of duplicate voting

### Performance Optimizations
- Database indexes on frequently queried fields
- Efficient JOIN queries for vote counts
- Proper connection management
- Transaction support for data integrity

### Error Handling
- Comprehensive error messages
- Database connection error handling
- Foreign key constraint enforcement
- Graceful handling of edge cases

## Usage Examples

```javascript
const { createUser, recordVote, checkVoteRestrictions } = require('./operations');

// Create a user
const user = await createUser({
  name: '张三',
  gender: 'male',
  avatarUrl: '/uploads/avatar.jpg'
});

// Record a vote
await recordVote({
  voterId: 'voter-id',
  targetUserId: user.id,
  ipAddress: '192.168.1.1'
});

// Check voting restrictions
const restrictions = await checkVoteRestrictions('voter-id');
console.log(restrictions.maleVoted); // true
```

## Testing

Run tests with:
```bash
npm test -- src/database/operations.test.js
npm test -- src/database/integration.test.js
```

The test suite includes:
- Unit tests for all functions
- Edge case validation
- Error condition testing
- Complete workflow integration tests
- Vote restriction enforcement tests

## Database Schema

### Users Table
- `id` (TEXT PRIMARY KEY) - Unique user identifier
- `name` (TEXT NOT NULL) - User's display name
- `gender` (TEXT) - 'male' or 'female'
- `avatar_url` (TEXT) - Path to user's avatar image
- `qr_code` (TEXT) - QR code data for voting
- `created_at` (DATETIME) - Creation timestamp
- `updated_at` (DATETIME) - Last update timestamp

### Votes Table
- `id` (INTEGER PRIMARY KEY) - Auto-increment vote ID
- `voter_id` (TEXT) - ID of the voter (nullable for anonymous)
- `target_user_id` (TEXT NOT NULL) - ID of voted user
- `vote_time` (DATETIME) - When vote was cast
- `ip_address` (TEXT) - Voter's IP address

### Vote Restrictions Table
- `id` (INTEGER PRIMARY KEY) - Auto-increment restriction ID
- `voter_id` (TEXT UNIQUE) - ID of the voter
- `male_voted_user_id` (TEXT) - ID of male user voted for
- `female_voted_user_id` (TEXT) - ID of female user voted for
- `created_at` (DATETIME) - Creation timestamp
- `updated_at` (DATETIME) - Last update timestamp

## Requirements Fulfilled

This implementation fulfills the following requirements:
- **需求 1.4**: User creation and default avatar assignment
- **需求 4.4**: Vote recording and counting
- **需求 6.1**: Real-time vote statistics and ranking
- **需求 5.1-5.5**: Complete vote restriction mechanism
- **需求 6.2-6.5**: Comprehensive ranking and statistics system