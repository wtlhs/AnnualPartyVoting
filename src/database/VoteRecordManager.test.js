const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const VoteRecordManager = require('./VoteRecordManager');
const AuditLogManager = require('./AuditLogManager');
const { createUser, recordVote, clearAllData } = require('./operations');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../../data/test_voting_records.db');

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
        numeric_id TEXT UNIQUE,
        avatar_url TEXT,
        qr_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create votes table with extended fields
    const createVotesTable = `
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_id TEXT,
        target_user_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        ip_address TEXT,
        user_agent TEXT,
        vote_method TEXT,
        vote_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_user_id) REFERENCES users(id)
      )
    `;
    
    // Create audit_logs table
    const createAuditLogsTable = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vote_id INTEGER NOT NULL,
        admin_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('deactivate', 'activate')),
        reason TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    
    // Create export_tasks table
    const createExportTasksTable = `
      CREATE TABLE IF NOT EXISTS export_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL CHECK(file_type IN ('csv', 'excel')),
        filters TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        error_message TEXT,
        file_size INTEGER,
        record_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        expires_at DATETIME,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
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
    
    db.serialize(() => {
      // Create tables
      db.run(createUsersTable);
      db.run(createVotesTable);
      db.run(createAuditLogsTable);
      db.run(createExportTasksTable);
      db.run(createVoteRestrictionsTable);
      
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
  const mockTestDbPath = path.join(__dirname, '../../data/test_voting_records.db');
  
  return {
    getDatabase: () => {
      return new sqlite3.Database(mockTestDbPath);
    }
  };
});

describe('VoteRecordManager', () => {
  let voteRecordManager;
  let auditLogManager;

  beforeAll(async () => {
    // Initialize test database
    await initTestDatabase();
    voteRecordManager = new VoteRecordManager();
    auditLogManager = new AuditLogManager();
  });

  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
  });

  afterAll(async () => {
    // Clean up test database file
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch (error) {
      console.warn('Could not clean up test database:', error.message);
    }
  });

  describe('getVoteRecords', () => {
    test('should return empty results when no votes exist', async () => {
      const result = await voteRecordManager.getVoteRecords();
      
      expect(result.records).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    test('should return vote records with pagination', async () => {
      // Create test data
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      
      await recordVote({
        voterId: voter.id,
        targetUserId: target.id,
        ipAddress: '192.168.1.1'
      });

      const result = await voteRecordManager.getVoteRecords({}, { page: 1, limit: 10 });
      
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toHaveProperty('id');
      expect(result.records[0].voterName).toBe('投票者');
      expect(result.records[0].targetName).toBe('被投票者');
      expect(result.records[0].status).toBe('active');
      expect(result.pagination.total).toBe(1);
    });

    test('should filter by status', async () => {
      // Create test data
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({
        voterId: voter.id,
        targetUserId: target.id
      });

      // Update vote status to inactive
      await voteRecordManager.updateVoteStatus(vote.id, 'inactive', admin.id, '测试作废');

      // Test active filter
      const activeResult = await voteRecordManager.getVoteRecords({ status: 'active' });
      expect(activeResult.records).toHaveLength(0);

      // Test inactive filter
      const inactiveResult = await voteRecordManager.getVoteRecords({ status: 'inactive' });
      expect(inactiveResult.records).toHaveLength(1);
      expect(inactiveResult.records[0].status).toBe('inactive');
    });

    test('should search by voter name', async () => {
      // Create test data
      const voter1 = await createUser({ name: '张三', gender: 'male' });
      const voter2 = await createUser({ name: '李四', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      
      await recordVote({ voterId: voter1.id, targetUserId: target.id });
      await recordVote({ voterId: voter2.id, targetUserId: target.id });

      const result = await voteRecordManager.getVoteRecords({ voter: '张三' });
      
      expect(result.records).toHaveLength(1);
      expect(result.records[0].voterName).toBe('张三');
    });
  });

  describe('getVoteRecordDetail', () => {
    test('should return vote record detail', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      
      const vote = await recordVote({
        voterId: voter.id,
        targetUserId: target.id,
        ipAddress: '192.168.1.1'
      });

      const detail = await voteRecordManager.getVoteRecordDetail(vote.id);
      
      expect(detail).not.toBeNull();
      expect(detail.id).toBe(vote.id);
      expect(detail.voterName).toBe('投票者');
      expect(detail.targetName).toBe('被投票者');
      expect(detail.ipAddress).toBe('192.168.1.1');
    });

    test('should return null for non-existent vote', async () => {
      const detail = await voteRecordManager.getVoteRecordDetail(99999);
      expect(detail).toBeNull();
    });
  });

  describe('updateVoteStatus', () => {
    test('should update vote status from active to inactive', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({
        voterId: voter.id,
        targetUserId: target.id
      });

      const result = await voteRecordManager.updateVoteStatus(
        vote.id, 
        'inactive', 
        admin.id, 
        '测试作废'
      );

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('inactive');
      expect(result.oldStatus).toBe('active');

      // Verify the vote was actually updated
      const detail = await voteRecordManager.getVoteRecordDetail(vote.id);
      expect(detail.status).toBe('inactive');
    });

    test('should reject invalid status', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({
        voterId: voter.id,
        targetUserId: target.id
      });

      await expect(
        voteRecordManager.updateVoteStatus(vote.id, 'invalid', admin.id)
      ).rejects.toThrow('状态值必须是 active 或 inactive');
    });

    test('should reject non-existent vote', async () => {
      const admin = await createUser({ name: '管理员', gender: 'male' });

      await expect(
        voteRecordManager.updateVoteStatus(99999, 'inactive', admin.id)
      ).rejects.toThrow('投票记录不存在');
    });
  });

  describe('batchUpdateVoteStatus', () => {
    test('should update multiple vote statuses', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target1 = await createUser({ name: '被投票者1', gender: 'female' });
      const target2 = await createUser({ name: '被投票者2', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote1 = await recordVote({ voterId: voter.id, targetUserId: target1.id });
      const vote2 = await recordVote({ voterId: voter.id, targetUserId: target2.id });

      const result = await voteRecordManager.batchUpdateVoteStatus(
        [vote1.id, vote2.id],
        'inactive',
        admin.id,
        '批量测试作废'
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test('should handle mixed results in batch update', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({ voterId: voter.id, targetUserId: target.id });

      const result = await voteRecordManager.batchUpdateVoteStatus(
        [vote.id, 99999], // One valid, one invalid
        'inactive',
        admin.id,
        '混合测试'
      );

      expect(result.updated).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('searchVoteRecords', () => {
    test('should search across voter and target names', async () => {
      const voter1 = await createUser({ name: '张三', gender: 'male' });
      const voter2 = await createUser({ name: '李四', gender: 'male' });
      const target1 = await createUser({ name: '王五', gender: 'female' });
      const target2 = await createUser({ name: '赵六', gender: 'female' });
      
      await recordVote({ voterId: voter1.id, targetUserId: target1.id });
      await recordVote({ voterId: voter2.id, targetUserId: target2.id });

      // Search for voter name
      const voterResult = await voteRecordManager.searchVoteRecords('张三');
      expect(voterResult.records).toHaveLength(1);
      expect(voterResult.records[0].voterName).toBe('张三');

      // Search for target name
      const targetResult = await voteRecordManager.searchVoteRecords('王五');
      expect(targetResult.records).toHaveLength(1);
      expect(targetResult.records[0].targetName).toBe('王五');
    });

    test('should return all records when search term is empty', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      
      await recordVote({ voterId: voter.id, targetUserId: target.id });

      const result = await voteRecordManager.searchVoteRecords('');
      expect(result.records).toHaveLength(1);
    });
  });
});

describe('AuditLogManager', () => {
  let auditLogManager;
  let voteRecordManager;

  beforeAll(async () => {
    auditLogManager = new AuditLogManager();
    voteRecordManager = new VoteRecordManager();
  });

  beforeEach(async () => {
    await clearAllData();
  });

  describe('logOperation', () => {
    test('should log deactivate operation', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({ voterId: voter.id, targetUserId: target.id });

      const log = await auditLogManager.logOperation(
        vote.id,
        admin.id,
        'deactivate',
        '测试作废',
        { source: 'unit_test' }
      );

      expect(log).toHaveProperty('id');
      expect(log.voteId).toBe(vote.id);
      expect(log.adminId).toBe(admin.id);
      expect(log.adminName).toBe('管理员');
      expect(log.operation).toBe('deactivate');
      expect(log.reason).toBe('测试作废');
      expect(log.metadata).toEqual({ source: 'unit_test' });
    });

    test('should reject invalid operation type', async () => {
      const admin = await createUser({ name: '管理员', gender: 'male' });

      await expect(
        auditLogManager.logOperation(1, admin.id, 'invalid_operation')
      ).rejects.toThrow('操作类型必须是 activate 或 deactivate');
    });
  });

  describe('getVoteOperationHistory', () => {
    test('should return operation history for a vote', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({ voterId: voter.id, targetUserId: target.id });

      // Log multiple operations
      await auditLogManager.logOperation(vote.id, admin.id, 'deactivate', '第一次作废');
      await auditLogManager.logOperation(vote.id, admin.id, 'activate', '恢复');
      await auditLogManager.logOperation(vote.id, admin.id, 'deactivate', '第二次作废');

      const history = await auditLogManager.getVoteOperationHistory(vote.id);

      expect(history).toHaveLength(3);
      expect(history[0].operation).toBe('deactivate'); // Most recent first
      expect(history[0].reason).toBe('第二次作废');
      expect(history[1].operation).toBe('activate');
      expect(history[2].operation).toBe('deactivate');
    });

    test('should return empty array for vote with no history', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      
      const vote = await recordVote({ voterId: voter.id, targetUserId: target.id });

      const history = await auditLogManager.getVoteOperationHistory(vote.id);
      expect(history).toEqual([]);
    });
  });

  describe('getAdminOperationLogs', () => {
    test('should return admin operation logs with pagination', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({ voterId: voter.id, targetUserId: target.id });

      await auditLogManager.logOperation(vote.id, admin.id, 'deactivate', '测试');

      const result = await auditLogManager.getAdminOperationLogs(admin.id);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].adminId).toBe(admin.id);
      expect(result.logs[0].operation).toBe('deactivate');
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getOperationStatistics', () => {
    test('should return operation statistics', async () => {
      const voter = await createUser({ name: '投票者', gender: 'male' });
      const target = await createUser({ name: '被投票者', gender: 'female' });
      const admin = await createUser({ name: '管理员', gender: 'male' });
      
      const vote = await recordVote({ voterId: voter.id, targetUserId: target.id });

      await auditLogManager.logOperation(vote.id, admin.id, 'deactivate', '测试');
      await auditLogManager.logOperation(vote.id, admin.id, 'activate', '恢复');

      const stats = await auditLogManager.getOperationStatistics();

      expect(stats.totalOperations).toBe(2);
      expect(stats.activateOperations).toBe(1);
      expect(stats.deactivateOperations).toBe(1);
      expect(stats.activeAdmins).toBe(1);
      expect(stats.affectedVotes).toBe(1);
    });
  });
});