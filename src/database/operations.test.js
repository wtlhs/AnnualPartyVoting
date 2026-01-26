const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../../data/test_voting.db');

// Create a test database initialization function
async function initTestDatabase() {
  return new Promise((resolve, reject) => {
    // Ensure data directory exists
    const dataDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
      if (err) {
        return reject(err);
      }
    });
    
    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON');
    
    // Create users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT CHECK(gender IN ('male', 'female')) NOT NULL,
        avatar_url TEXT,
        qr_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create votes table
    const createVotesTable = `
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_id TEXT,
        target_user_id TEXT NOT NULL,
        vote_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        FOREIGN KEY (target_user_id) REFERENCES users(id)
      )
    `;
    
    // Create vote_restrictions table
    const createVoteRestrictionsTable = `
      CREATE TABLE IF NOT EXISTS vote_restrictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_id TEXT NOT NULL UNIQUE,
        male_voted_user_id TEXT,
        female_voted_user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (male_voted_user_id) REFERENCES users(id),
        FOREIGN KEY (female_voted_user_id) REFERENCES users(id)
      )
    `;
    
    // Create indexes
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_voter_id ON votes(voter_id)',
      'CREATE INDEX IF NOT EXISTS idx_target_user_id ON votes(target_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_vote_restrictions_voter_id ON vote_restrictions(voter_id)'
    ];
    
    db.serialize(() => {
      // Create tables
      db.run(createUsersTable);
      db.run(createVotesTable);
      db.run(createVoteRestrictionsTable);
      
      // Create indexes
      createIndexes.forEach((indexSQL) => {
        db.run(indexSQL);
      });
      
      db.close((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

// Mock the database path for testing
jest.mock('./init', () => {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const mockTestDbPath = path.join(__dirname, '../../data/test_voting.db');
  
  return {
    getDatabase: () => {
      return new sqlite3.Database(mockTestDbPath);
    }
  };
});

const {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getAllUsers,
  recordVote,
  getVoteStatistics,
  getRanking,
  getVotesForUser,
  getRecentVotes,
  getVotingProgress,
  checkVoteRestrictions,
  updateVoteRestrictions,
  canVoteForGender,
  clearAllData
} = require('./operations');

describe('Database Operations', () => {
  beforeAll(async () => {
    // Initialize test database
    await initTestDatabase();
  });

  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
  });

  afterAll(async () => {
    // Clean up test database file
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit for connections to close
    try {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Could not clean up test database:', error.message);
    }
  });

  describe('User Operations', () => {
    describe('createUser', () => {
      test('should create a user with valid data', async () => {
        const userData = {
          name: '张三',
          gender: 'male'
        };

        const user = await createUser(userData);

        expect(user).toHaveProperty('id');
        expect(user.name).toBe('张三');
        expect(user.gender).toBe('male');
        expect(user.avatarUrl).toBeNull();
        expect(user.qrCode).toBeNull();
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('updatedAt');
      });

      test('should create a user with avatar and QR code', async () => {
        const userData = {
          name: '李四',
          gender: 'female',
          avatarUrl: '/uploads/avatar.jpg',
          qrCode: 'qr_code_data'
        };

        const user = await createUser(userData);

        expect(user.name).toBe('李四');
        expect(user.gender).toBe('female');
        expect(user.avatarUrl).toBe('/uploads/avatar.jpg');
        expect(user.qrCode).toBe('qr_code_data');
      });

      test('should trim whitespace from name', async () => {
        const userData = {
          name: '  王五  ',
          gender: 'male'
        };

        const user = await createUser(userData);
        expect(user.name).toBe('王五');
      });

      test('should reject empty name', async () => {
        const userData = {
          name: '',
          gender: 'male'
        };

        await expect(createUser(userData)).rejects.toThrow('Name is required and cannot be empty');
      });

      test('should reject whitespace-only name', async () => {
        const userData = {
          name: '   ',
          gender: 'male'
        };

        await expect(createUser(userData)).rejects.toThrow('Name is required and cannot be empty');
      });

      test('should reject invalid gender', async () => {
        const userData = {
          name: '张三',
          gender: 'invalid'
        };

        await expect(createUser(userData)).rejects.toThrow('Gender must be either "male" or "female"');
      });

      test('should reject missing gender', async () => {
        const userData = {
          name: '张三'
        };

        await expect(createUser(userData)).rejects.toThrow('Gender must be either "male" or "female"');
      });
    });

    describe('getUserById', () => {
      test('should get user by ID with vote count', async () => {
        const userData = {
          name: '张三',
          gender: 'male'
        };

        const createdUser = await createUser(userData);
        const retrievedUser = await getUserById(createdUser.id);

        expect(retrievedUser).not.toBeNull();
        expect(retrievedUser.id).toBe(createdUser.id);
        expect(retrievedUser.name).toBe('张三');
        expect(retrievedUser.gender).toBe('male');
        expect(retrievedUser.voteCount).toBe(0);
      });

      test('should return null for non-existent user', async () => {
        const user = await getUserById('non-existent-id');
        expect(user).toBeNull();
      });

      test('should include vote count when user has votes', async () => {
        // Create two users
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const target = await createUser({ name: '被投票者', gender: 'female' });

        // Record a vote
        await recordVote({
          voterId: voter.id,
          targetUserId: target.id
        });

        const retrievedUser = await getUserById(target.id);
        expect(retrievedUser.voteCount).toBe(1);
      });
    });

    describe('updateUser', () => {
      test('should update user name', async () => {
        const user = await createUser({ name: '张三', gender: 'male' });
        
        const updatedUser = await updateUser(user.id, { name: '张三丰' });
        
        expect(updatedUser.name).toBe('张三丰');
        expect(updatedUser.gender).toBe('male'); // Should remain unchanged
      });

      test('should update avatar URL', async () => {
        const user = await createUser({ name: '张三', gender: 'male' });
        
        const updatedUser = await updateUser(user.id, { avatarUrl: '/uploads/new-avatar.jpg' });
        
        expect(updatedUser.avatarUrl).toBe('/uploads/new-avatar.jpg');
      });

      test('should update QR code', async () => {
        const user = await createUser({ name: '张三', gender: 'male' });
        
        const updatedUser = await updateUser(user.id, { qrCode: 'new_qr_code' });
        
        expect(updatedUser.qrCode).toBe('new_qr_code');
      });

      test('should reject empty name update', async () => {
        const user = await createUser({ name: '张三', gender: 'male' });
        
        await expect(updateUser(user.id, { name: '' })).rejects.toThrow('Name cannot be empty');
      });

      test('should reject update with no fields', async () => {
        const user = await createUser({ name: '张三', gender: 'male' });
        
        await expect(updateUser(user.id, {})).rejects.toThrow('No fields to update');
      });

      test('should reject update for non-existent user', async () => {
        await expect(updateUser('non-existent-id', { name: '新名字' })).rejects.toThrow('User not found');
      });
    });

    describe('deleteUser', () => {
      test('should delete user successfully', async () => {
        const user = await createUser({ name: '张三', gender: 'male' });
        
        const result = await deleteUser(user.id);
        expect(result).toBe(true);
        
        const deletedUser = await getUserById(user.id);
        expect(deletedUser).toBeNull();
      });

      test('should delete user and related votes', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const target = await createUser({ name: '被投票者', gender: 'female' });

        // Record a vote
        await recordVote({
          voterId: voter.id,
          targetUserId: target.id
        });

        // Delete the target user
        await deleteUser(target.id);

        // Check that votes are also deleted
        const votes = await getVotesForUser(target.id);
        expect(votes).toHaveLength(0);
      });

      test('should reject deletion of non-existent user', async () => {
        await expect(deleteUser('non-existent-id')).rejects.toThrow('User not found');
      });
    });

    describe('getAllUsers', () => {
      test('should return empty array when no users exist', async () => {
        const users = await getAllUsers();
        expect(users).toEqual([]);
      });

      test('should return all users with vote counts', async () => {
        const user1 = await createUser({ name: '张三', gender: 'male' });
        const user2 = await createUser({ name: '李四', gender: 'female' });

        // Record a vote for user1
        await recordVote({
          voterId: user2.id,
          targetUserId: user1.id
        });

        const users = await getAllUsers();
        expect(users).toHaveLength(2);
        
        const retrievedUser1 = users.find(u => u.id === user1.id);
        const retrievedUser2 = users.find(u => u.id === user2.id);
        
        expect(retrievedUser1.voteCount).toBe(1);
        expect(retrievedUser2.voteCount).toBe(0);
      });
    });
  });

  describe('Voting Operations', () => {
    describe('recordVote', () => {
      test('should record a vote successfully', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const target = await createUser({ name: '被投票者', gender: 'female' });

        const vote = await recordVote({
          voterId: voter.id,
          targetUserId: target.id,
          ipAddress: '192.168.1.1'
        });

        expect(vote).toHaveProperty('id');
        expect(vote.voterId).toBe(voter.id);
        expect(vote.targetUserId).toBe(target.id);
        expect(vote.ipAddress).toBe('192.168.1.1');
        expect(vote).toHaveProperty('voteTime');
      });

      test('should record anonymous vote', async () => {
        const target = await createUser({ name: '被投票者', gender: 'female' });

        const vote = await recordVote({
          targetUserId: target.id
        });

        expect(vote.voterId).toBeNull();
        expect(vote.targetUserId).toBe(target.id);
      });

      test('should reject vote without target user ID', async () => {
        await expect(recordVote({})).rejects.toThrow('Target user ID is required');
      });
    });

    describe('getVoteStatistics', () => {
      test('should return zero statistics when no data exists', async () => {
        const stats = await getVoteStatistics();
        
        expect(stats.totalParticipants).toBe(0);
        expect(stats.totalVotes).toBe(0);
        expect(stats.maleParticipants).toBe(0);
        expect(stats.femaleParticipants).toBe(0);
        expect(stats.maleVotes).toBe(0);
        expect(stats.femaleVotes).toBe(0);
      });

      test('should calculate statistics correctly', async () => {
        const maleUser1 = await createUser({ name: '男士1', gender: 'male' });
        const maleUser2 = await createUser({ name: '男士2', gender: 'male' });
        const femaleUser1 = await createUser({ name: '女士1', gender: 'female' });

        // Record votes
        await recordVote({ targetUserId: maleUser1.id });
        await recordVote({ targetUserId: maleUser1.id });
        await recordVote({ targetUserId: femaleUser1.id });

        const stats = await getVoteStatistics();
        
        expect(stats.totalParticipants).toBe(3);
        expect(stats.totalVotes).toBe(3);
        expect(stats.maleParticipants).toBe(2);
        expect(stats.femaleParticipants).toBe(1);
        expect(stats.maleVotes).toBe(2);
        expect(stats.femaleVotes).toBe(1);
      });
    });

    describe('getRanking', () => {
      test('should return empty ranking when no users exist', async () => {
        const ranking = await getRanking();
        
        expect(ranking.male).toEqual([]);
        expect(ranking.female).toEqual([]);
      });

      test('should calculate ranking correctly', async () => {
        const male1 = await createUser({ name: '男士1', gender: 'male' });
        const male2 = await createUser({ name: '男士2', gender: 'male' });
        const female1 = await createUser({ name: '女士1', gender: 'female' });

        // Record votes (male1 gets 2 votes, male2 gets 1, female1 gets 3)
        await recordVote({ targetUserId: male1.id });
        await recordVote({ targetUserId: male1.id });
        await recordVote({ targetUserId: male2.id });
        await recordVote({ targetUserId: female1.id });
        await recordVote({ targetUserId: female1.id });
        await recordVote({ targetUserId: female1.id });

        const ranking = await getRanking();
        
        expect(ranking.male).toHaveLength(2);
        expect(ranking.female).toHaveLength(1);
        
        // Check male ranking (sorted by vote count desc)
        expect(ranking.male[0].userId).toBe(male1.id);
        expect(ranking.male[0].voteCount).toBe(2);
        expect(ranking.male[0].rank).toBe(1);
        
        expect(ranking.male[1].userId).toBe(male2.id);
        expect(ranking.male[1].voteCount).toBe(1);
        expect(ranking.male[1].rank).toBe(2);
        
        // Check female ranking
        expect(ranking.female[0].userId).toBe(female1.id);
        expect(ranking.female[0].voteCount).toBe(3);
        expect(ranking.female[0].rank).toBe(1);
      });

      test('should filter by gender', async () => {
        const male1 = await createUser({ name: '男士1', gender: 'male' });
        const female1 = await createUser({ name: '女士1', gender: 'female' });

        const maleRanking = await getRanking('male');
        const femaleRanking = await getRanking('female');
        
        expect(maleRanking.male).toHaveLength(1);
        expect(maleRanking.female).toHaveLength(0);
        
        expect(femaleRanking.male).toHaveLength(0);
        expect(femaleRanking.female).toHaveLength(1);
      });
    });

    describe('getVotesForUser', () => {
      test('should return empty array for user with no votes', async () => {
        const user = await createUser({ name: '张三', gender: 'male' });
        
        const votes = await getVotesForUser(user.id);
        expect(votes).toEqual([]);
      });

      test('should return votes for user', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const target = await createUser({ name: '被投票者', gender: 'female' });

        await recordVote({
          voterId: voter.id,
          targetUserId: target.id,
          ipAddress: '192.168.1.1'
        });

        const votes = await getVotesForUser(target.id);
        
        expect(votes).toHaveLength(1);
        expect(votes[0].voterId).toBe(voter.id);
        expect(votes[0].voterName).toBe('投票者');
        expect(votes[0].targetUserId).toBe(target.id);
        expect(votes[0].ipAddress).toBe('192.168.1.1');
      });
    });
  });

  describe('Vote Restriction Operations', () => {
    describe('checkVoteRestrictions', () => {
      test('should return no restrictions for new voter', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        
        const restrictions = await checkVoteRestrictions(voter.id);
        
        expect(restrictions.voterId).toBe(voter.id);
        expect(restrictions.maleVoted).toBe(false);
        expect(restrictions.femaleVoted).toBe(false);
        expect(restrictions.maleVotedUserId).toBeNull();
        expect(restrictions.femaleVotedUserId).toBeNull();
        expect(restrictions.votedUsers).toEqual([]);
      });

      test('should return restrictions after voting', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const maleTarget = await createUser({ name: '男士被投票者', gender: 'male' });
        const femaleTarget = await createUser({ name: '女士被投票者', gender: 'female' });

        // Vote for male target
        await updateVoteRestrictions(voter.id, maleTarget.id, 'male');
        
        let restrictions = await checkVoteRestrictions(voter.id);
        expect(restrictions.maleVoted).toBe(true);
        expect(restrictions.femaleVoted).toBe(false);
        expect(restrictions.maleVotedUserId).toBe(maleTarget.id);
        expect(restrictions.votedUsers).toHaveLength(1);

        // Vote for female target
        await updateVoteRestrictions(voter.id, femaleTarget.id, 'female');
        
        restrictions = await checkVoteRestrictions(voter.id);
        expect(restrictions.maleVoted).toBe(true);
        expect(restrictions.femaleVoted).toBe(true);
        expect(restrictions.femaleVotedUserId).toBe(femaleTarget.id);
        expect(restrictions.votedUsers).toHaveLength(2);
      });
    });

    describe('updateVoteRestrictions', () => {
      test('should create new restriction record', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const target = await createUser({ name: '被投票者', gender: 'female' });

        const restrictions = await updateVoteRestrictions(voter.id, target.id, 'female');
        
        expect(restrictions.femaleVoted).toBe(true);
        expect(restrictions.femaleVotedUserId).toBe(target.id);
        expect(restrictions.maleVoted).toBe(false);
      });

      test('should update existing restriction record', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const maleTarget = await createUser({ name: '男士被投票者', gender: 'male' });
        const femaleTarget = await createUser({ name: '女士被投票者', gender: 'female' });

        // First vote
        await updateVoteRestrictions(voter.id, maleTarget.id, 'male');
        
        // Second vote
        const restrictions = await updateVoteRestrictions(voter.id, femaleTarget.id, 'female');
        
        expect(restrictions.maleVoted).toBe(true);
        expect(restrictions.femaleVoted).toBe(true);
        expect(restrictions.maleVotedUserId).toBe(maleTarget.id);
        expect(restrictions.femaleVotedUserId).toBe(femaleTarget.id);
      });

      test('should reject invalid gender', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const target = await createUser({ name: '被投票者', gender: 'female' });

        await expect(updateVoteRestrictions(voter.id, target.id, 'invalid'))
          .rejects.toThrow('Target gender must be either "male" or "female"');
      });
    });

    describe('canVoteForGender', () => {
      test('should allow voting for both genders initially', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        
        const canVoteMale = await canVoteForGender(voter.id, 'male');
        const canVoteFemale = await canVoteForGender(voter.id, 'female');
        
        expect(canVoteMale).toBe(true);
        expect(canVoteFemale).toBe(true);
      });

      test('should restrict voting after vote is cast', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        const target = await createUser({ name: '被投票者', gender: 'female' });

        // Vote for female
        await updateVoteRestrictions(voter.id, target.id, 'female');
        
        const canVoteMale = await canVoteForGender(voter.id, 'male');
        const canVoteFemale = await canVoteForGender(voter.id, 'female');
        
        expect(canVoteMale).toBe(true);
        expect(canVoteFemale).toBe(false);
      });

      test('should return false for invalid gender', async () => {
        const voter = await createUser({ name: '投票者', gender: 'male' });
        
        const canVote = await canVoteForGender(voter.id, 'invalid');
        expect(canVote).toBe(false);
      });
    });

    describe('getRecentVotes', () => {
      test('should return empty array when no votes exist', async () => {
        const votes = await getRecentVotes();
        expect(votes).toEqual([]);
      });

      test('should return recent votes with user information', async () => {
        // Create users
        const user1 = await createUser({ name: '张三', gender: 'male' });
        const user2 = await createUser({ name: '李四', gender: 'female' });
        const voter = await createUser({ name: '王五', gender: 'male' });

        // Record votes
        await recordVote({ voterId: voter.id, targetUserId: user1.id });
        await recordVote({ voterId: null, targetUserId: user2.id }); // Anonymous vote

        const votes = await getRecentVotes(5);
        expect(votes).toHaveLength(2);
        
        // Check that both votes are present (order may vary)
        const targetNames = votes.map(v => v.targetName);
        expect(targetNames).toContain('张三');
        expect(targetNames).toContain('李四');
        
        // Check voter information
        const voteWithVoter = votes.find(v => v.voterName === '王五');
        const anonymousVote = votes.find(v => v.voterName === null);
        
        expect(voteWithVoter).toBeDefined();
        expect(anonymousVote).toBeDefined();
      });

      test('should limit results correctly', async () => {
        // Create users and votes
        const user = await createUser({ name: '张三', gender: 'male' });
        
        // Record multiple votes
        for (let i = 0; i < 5; i++) {
          await recordVote({ voterId: null, targetUserId: user.id });
        }

        const votes = await getRecentVotes(3);
        expect(votes).toHaveLength(3);
      });
    });

    describe('getVotingProgress', () => {
      test('should return zero progress when no votes exist', async () => {
        const progress = await getVotingProgress();
        expect(progress.activeVoters).toBe(0);
        expect(progress.maleVotesCast).toBe(0);
        expect(progress.femaleVotesCast).toBe(0);
        expect(progress.completedVoters).toBe(0);
        expect(progress.votingCompletionRate).toBe('0.00');
      });

      test('should calculate voting progress correctly', async () => {
        // Create users
        const maleUser = await createUser({ name: '张三', gender: 'male' });
        const femaleUser = await createUser({ name: '李四', gender: 'female' });
        
        // Create voters and vote
        const voter1 = 'voter1';
        const voter2 = 'voter2';
        const voter3 = 'voter3';

        // Voter1: votes for both (complete)
        await recordVote({ voterId: voter1, targetUserId: maleUser.id });
        await updateVoteRestrictions(voter1, maleUser.id, 'male');
        await recordVote({ voterId: voter1, targetUserId: femaleUser.id });
        await updateVoteRestrictions(voter1, femaleUser.id, 'female');

        // Voter2: votes for male only (incomplete)
        await recordVote({ voterId: voter2, targetUserId: maleUser.id });
        await updateVoteRestrictions(voter2, maleUser.id, 'male');

        // Voter3: votes for female only (incomplete)
        await recordVote({ voterId: voter3, targetUserId: femaleUser.id });
        await updateVoteRestrictions(voter3, femaleUser.id, 'female');

        const progress = await getVotingProgress();
        expect(progress.activeVoters).toBe(3);
        expect(progress.maleVotesCast).toBe(2);
        expect(progress.femaleVotesCast).toBe(2);
        expect(progress.completedVoters).toBe(1);
        expect(progress.votingCompletionRate).toBe('33.33');
      });
    });
  });
});