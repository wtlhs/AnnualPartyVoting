const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../../data/integration_test.db');

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
  const mockTestDbPath = path.join(__dirname, '../../data/integration_test.db');
  
  return {
    getDatabase: () => {
      return new sqlite3.Database(mockTestDbPath);
    }
  };
});

const {
  createUser,
  getUserById,
  recordVote,
  getRanking,
  checkVoteRestrictions,
  updateVoteRestrictions,
  canVoteForGender,
  clearAllData
} = require('./operations');

describe('Database Operations Integration', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(async () => {
    await clearAllData();
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch (error) {
      console.warn('Could not clean up integration test database:', error.message);
    }
  });

  test('complete voting workflow', async () => {
    // 1. Create participants
    const male1 = await createUser({ name: '张三', gender: 'male' });
    const male2 = await createUser({ name: '李四', gender: 'male' });
    const female1 = await createUser({ name: '王五', gender: 'female' });
    const female2 = await createUser({ name: '赵六', gender: 'female' });

    // 2. Create voters (different genders to avoid confusion)
    const voter1 = await createUser({ name: '投票者1', gender: 'female' }); // Changed to female
    const voter2 = await createUser({ name: '投票者2', gender: 'male' });   // Changed to male

    // 3. Check initial vote restrictions (should allow all)
    let restrictions1 = await checkVoteRestrictions(voter1.id);
    expect(restrictions1.maleVoted).toBe(false);
    expect(restrictions1.femaleVoted).toBe(false);

    let canVoteMale = await canVoteForGender(voter1.id, 'male');
    let canVoteFemale = await canVoteForGender(voter1.id, 'female');
    expect(canVoteMale).toBe(true);
    expect(canVoteFemale).toBe(true);

    // 4. Voter1 votes for male1
    await recordVote({
      voterId: voter1.id,
      targetUserId: male1.id,
      ipAddress: '192.168.1.1'
    });
    await updateVoteRestrictions(voter1.id, male1.id, 'male');

    // 5. Check restrictions after male vote
    restrictions1 = await checkVoteRestrictions(voter1.id);
    expect(restrictions1.maleVoted).toBe(true);
    expect(restrictions1.femaleVoted).toBe(false);
    expect(restrictions1.maleVotedUserId).toBe(male1.id);

    canVoteMale = await canVoteForGender(voter1.id, 'male');
    canVoteFemale = await canVoteForGender(voter1.id, 'female');
    expect(canVoteMale).toBe(false);
    expect(canVoteFemale).toBe(true);

    // 6. Voter1 votes for female1
    await recordVote({
      voterId: voter1.id,
      targetUserId: female1.id,
      ipAddress: '192.168.1.1'
    });
    await updateVoteRestrictions(voter1.id, female1.id, 'female');

    // 7. Check restrictions after both votes
    restrictions1 = await checkVoteRestrictions(voter1.id);
    expect(restrictions1.maleVoted).toBe(true);
    expect(restrictions1.femaleVoted).toBe(true);
    expect(restrictions1.votedUsers).toHaveLength(2);

    canVoteMale = await canVoteForGender(voter1.id, 'male');
    canVoteFemale = await canVoteForGender(voter1.id, 'female');
    expect(canVoteMale).toBe(false);
    expect(canVoteFemale).toBe(false);

    // 8. Voter2 votes for different candidates
    await recordVote({ voterId: voter2.id, targetUserId: male2.id });
    await updateVoteRestrictions(voter2.id, male2.id, 'male');
    
    await recordVote({ voterId: voter2.id, targetUserId: female2.id });
    await updateVoteRestrictions(voter2.id, female2.id, 'female');

    // 9. Add more votes to create ranking
    await recordVote({ targetUserId: male1.id }); // Anonymous vote
    await recordVote({ targetUserId: female1.id }); // Anonymous vote
    await recordVote({ targetUserId: female1.id }); // Another anonymous vote

    // 10. Check final ranking
    const ranking = await getRanking();
    
    // Male ranking: male1 (2 votes) should be first, male2 (1 vote) second, voter2 (0 votes) third
    expect(ranking.male).toHaveLength(3);
    expect(ranking.male[0].userId).toBe(male1.id);
    expect(ranking.male[0].voteCount).toBe(2);
    expect(ranking.male[0].rank).toBe(1);
    expect(ranking.male[1].userId).toBe(male2.id);
    expect(ranking.male[1].voteCount).toBe(1);
    expect(ranking.male[1].rank).toBe(2);
    expect(ranking.male[2].userId).toBe(voter2.id);
    expect(ranking.male[2].voteCount).toBe(0);
    expect(ranking.male[2].rank).toBe(3);

    // Female ranking: female1 (3 votes) should be first, female2 (1 vote) second, voter1 (0 votes) third
    expect(ranking.female).toHaveLength(3);
    expect(ranking.female[0].userId).toBe(female1.id);
    expect(ranking.female[0].voteCount).toBe(3);
    expect(ranking.female[0].rank).toBe(1);
    expect(ranking.female[1].userId).toBe(female2.id);
    expect(ranking.female[1].voteCount).toBe(1);
    expect(ranking.female[1].rank).toBe(2);
    expect(ranking.female[2].userId).toBe(voter1.id);
    expect(ranking.female[2].voteCount).toBe(0);
    expect(ranking.female[2].rank).toBe(3);

    // 11. Verify user data includes vote counts
    const updatedMale1 = await getUserById(male1.id);
    const updatedFemale1 = await getUserById(female1.id);
    expect(updatedMale1.voteCount).toBe(2);
    expect(updatedFemale1.voteCount).toBe(3);
  });

  test('vote restriction enforcement', async () => {
    const male1 = await createUser({ name: '男士1', gender: 'male' });
    const male2 = await createUser({ name: '男士2', gender: 'male' });
    const voter = await createUser({ name: '投票者', gender: 'female' });

    // First vote for male1
    await recordVote({ voterId: voter.id, targetUserId: male1.id });
    await updateVoteRestrictions(voter.id, male1.id, 'male');

    // Should not be able to vote for another male
    const canVoteForAnotherMale = await canVoteForGender(voter.id, 'male');
    expect(canVoteForAnotherMale).toBe(false);

    // Verify restriction details
    const restrictions = await checkVoteRestrictions(voter.id);
    expect(restrictions.maleVoted).toBe(true);
    expect(restrictions.maleVotedUserId).toBe(male1.id);
    expect(restrictions.maleVotedName).toBe('男士1');
  });
});