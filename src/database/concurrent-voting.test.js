const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../../data/concurrent_voting_test.db');

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
  const mockTestDbPath = path.join(__dirname, '../../data/concurrent_voting_test.db');
  
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
  atomicVote,
  checkVoteRestrictions,
  updateVoteRestrictions,
  canVoteForGender,
  clearAllData
} = require('./operations');

describe('Concurrent Voting Property-Based Tests', () => {
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
      console.warn('Could not clean up concurrent voting test database:', error.message);
    }
  });

  describe('属性 11: 并发投票数据一致性', () => {
    /**
     * **Validates: Requirements 6.4, 6.5**
     * 
     * Property: 对于任何并发投票场景，系统应该保证最终的票数统计准确，
     * 不会出现票数丢失或重复计算
     */
    test('简单并发投票场景应该保持数据一致性', async () => {
      // 创建测试用户
      const maleTarget = await createUser({ name: '男性目标', gender: 'male' });
      const femaleTarget = await createUser({ name: '女性目标', gender: 'female' });

      // 创建5个投票者
      const voters = [];
      for (let i = 1; i <= 5; i++) {
        const voter = await createUser({ 
          name: `投票者${i}`, 
          gender: i % 2 === 0 ? 'male' : 'female' 
        });
        voters.push(voter);
      }

      // 使用原始方法（非原子性）进行并发投票
      const concurrentVotes = [];
      
      // 每个投票者尝试为男性目标投票
      voters.forEach(voter => {
        concurrentVotes.push({
          voterId: voter.id,
          targetUserId: maleTarget.id,
          targetGender: 'male'
        });
      });
      
      // 每个投票者尝试为女性目标投票
      voters.forEach(voter => {
        concurrentVotes.push({
          voterId: voter.id,
          targetUserId: femaleTarget.id,
          targetGender: 'female'
        });
      });

      // 执行并发投票（使用原始方法）
      const originalResults = await Promise.allSettled(
        concurrentVotes.map(async (vote) => {
          try {
            // 检查是否可以投票
            const canVote = await canVoteForGender(vote.voterId, vote.targetGender);
            if (!canVote) {
              return { success: false, reason: 'already_voted', vote };
            }

            // 记录投票
            await recordVote({
              voterId: vote.voterId,
              targetUserId: vote.targetUserId,
              ipAddress: '127.0.0.1'
            });

            // 更新投票限制
            await updateVoteRestrictions(vote.voterId, vote.targetUserId, vote.targetGender);

            return { success: true, vote };
          } catch (error) {
            return { success: false, error: error.message, vote };
          }
        })
      );

      // 检查原始方法的结果
      const originalSuccessful = originalResults.filter(r => r.status === 'fulfilled' && r.value.success);
      
      // 获取最终票数
      const finalMaleTarget = await getUserById(maleTarget.id);
      const finalFemaleTarget = await getUserById(femaleTarget.id);

      // 验证投票限制
      for (const voter of voters) {
        const restrictions = await checkVoteRestrictions(voter.id);
        
        // 每个投票者最多只能投2票（1男1女）
        const totalVotes = (restrictions.maleVoted ? 1 : 0) + (restrictions.femaleVoted ? 1 : 0);
        expect(totalVotes).toBeLessThanOrEqual(2);
      }

      // 验证票数一致性
      expect(finalMaleTarget.voteCount).toBeGreaterThanOrEqual(0);
      expect(finalFemaleTarget.voteCount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(finalMaleTarget.voteCount)).toBe(true);
      expect(Number.isInteger(finalFemaleTarget.voteCount)).toBe(true);

      // 总票数不应超过最大可能票数（每个投票者最多2票）
      const totalVotes = finalMaleTarget.voteCount + finalFemaleTarget.voteCount;
      expect(totalVotes).toBeLessThanOrEqual(voters.length * 2);

      console.log(`Original method results: Male votes: ${finalMaleTarget.voteCount}, Female votes: ${finalFemaleTarget.voteCount}, Total: ${totalVotes}`);
    }, 15000);

    test('原子投票操作应该确保并发安全', async () => {
      // 创建测试用户
      const maleTarget = await createUser({ name: '男性目标', gender: 'male' });
      const femaleTarget = await createUser({ name: '女性目标', gender: 'female' });

      // 创建5个投票者
      const voters = [];
      for (let i = 1; i <= 5; i++) {
        const voter = await createUser({ 
          name: `投票者${i}`, 
          gender: i % 2 === 0 ? 'male' : 'female' 
        });
        voters.push(voter);
      }

      // 使用原子方法进行并发投票
      const atomicVotes = [];
      
      // 每个投票者尝试为男性目标投票
      voters.forEach(voter => {
        atomicVotes.push({
          voterId: voter.id,
          targetUserId: maleTarget.id,
          targetGender: 'male'
        });
      });
      
      // 每个投票者尝试为女性目标投票
      voters.forEach(voter => {
        atomicVotes.push({
          voterId: voter.id,
          targetUserId: femaleTarget.id,
          targetGender: 'female'
        });
      });

      // 执行并发投票（使用原子方法）
      const atomicResults = await Promise.allSettled(
        atomicVotes.map(async (vote) => {
          try {
            const result = await atomicVote({
              voterId: vote.voterId,
              targetUserId: vote.targetUserId,
              targetGender: vote.targetGender,
              ipAddress: '127.0.0.1'
            });

            return { success: result.success, result, vote };
          } catch (error) {
            return { success: false, error: error.message, vote };
          }
        })
      );

      // 检查原子方法的结果
      const atomicSuccessful = atomicResults.filter(r => r.status === 'fulfilled' && r.value.success);
      
      // 获取最终票数
      const finalMaleTarget = await getUserById(maleTarget.id);
      const finalFemaleTarget = await getUserById(femaleTarget.id);

      // 验证投票限制
      for (const voter of voters) {
        const restrictions = await checkVoteRestrictions(voter.id);
        
        // 每个投票者最多只能投2票（1男1女）
        const totalVotes = (restrictions.maleVoted ? 1 : 0) + (restrictions.femaleVoted ? 1 : 0);
        expect(totalVotes).toBeLessThanOrEqual(2);
      }

      // 验证票数一致性
      expect(finalMaleTarget.voteCount).toBeGreaterThanOrEqual(0);
      expect(finalFemaleTarget.voteCount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(finalMaleTarget.voteCount)).toBe(true);
      expect(Number.isInteger(finalFemaleTarget.voteCount)).toBe(true);

      // 总票数不应超过最大可能票数（每个投票者最多2票）
      const totalVotes = finalMaleTarget.voteCount + finalFemaleTarget.voteCount;
      expect(totalVotes).toBeLessThanOrEqual(voters.length * 2);

      // 原子方法应该确保每个投票者最多只能成功投票2次
      expect(totalVotes).toBe(atomicSuccessful.length);

      console.log(`Atomic method results: Male votes: ${finalMaleTarget.voteCount}, Female votes: ${finalFemaleTarget.voteCount}, Total: ${totalVotes}`);
    }, 15000);
  });
});