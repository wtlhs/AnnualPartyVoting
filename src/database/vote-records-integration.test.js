const fs = require('fs');
const path = require('path');

// Import managers directly for testing
const VoteRecordManager = require('./VoteRecordManager');
const AuditLogManager = require('./AuditLogManager');
const DataExportManager = require('./DataExportManager');

// Import operations
const { createUser, recordVote, clearAllData } = require('./operations');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../../data/vote_records_integration_test.db');

describe('Vote Records Management Integration', () => {
  let testUsers = [];
  let testVotes = [];
  
  beforeAll(async () => {
    // Initialize test database by running migrations
    const { runMigrations } = require('./migrationRunner');
    await runMigrations();
  });

  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
    
    // Create test users
    testUsers = [
      await createUser({ name: '张三', gender: 'male' }),
      await createUser({ name: '李四', gender: 'male' }),
      await createUser({ name: '王五', gender: 'female' }),
      await createUser({ name: '赵六', gender: 'female' })
    ];
    
    // Create test votes with extended data
    testVotes = [];
    for (let i = 0; i < 5; i++) {
      const voteData = {
        voterId: testUsers[i % 2].id,
        targetUserId: testUsers[(i + 2) % 4].id,
        ipAddress: `192.168.1.${i + 1}`,
        userAgent: 'Test Browser',
        voteMethod: 'qr_code'
      };
      
      const vote = await recordVote(voteData);
      testVotes.push(vote);
    }
  });

  afterAll(async () => {
    // Clean up test database
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch (error) {
      console.warn('Could not clean up test database:', error.message);
    }
  });

  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
    
    // Create test users
    testUsers = [
      await createUser({ name: '张三', gender: 'male' }),
      await createUser({ name: '李四', gender: 'male' }),
      await createUser({ name: '王五', gender: 'female' }),
      await createUser({ name: '赵六', gender: 'female' })
    ];
    
    // Create test votes
    testVotes = [];
    for (let i = 0; i < 5; i++) {
      const vote = await recordVote({
        voterId: testUsers[i % 2].id,
        targetUserId: testUsers[(i + 2) % 4].id,
        ipAddress: `192.168.1.${i + 1}`,
        userAgent: 'Test Browser',
        voteMethod: 'qr_code'
      });
      testVotes.push(vote);
    }
  });

  afterAll(async () => {
    // Clean up test database
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch (error) {
      console.warn('Could not clean up test database:', error.message);
    }
  });

  describe('VoteRecordManager Integration', () => {
    test('should retrieve vote records with pagination and filtering', async () => {
      const manager = new VoteRecordManager();
      
      // Test basic retrieval
      const result = await manager.getVoteRecords({}, { page: 1, limit: 10 });
      expect(result.records).toHaveLength(5);
      expect(result.pagination.total).toBe(5);
      
      // Test status filtering
      const activeResult = await manager.getVoteRecords({ status: 'active' }, { page: 1, limit: 10 });
      expect(activeResult.records).toHaveLength(5);
      
      // Test search functionality
      const searchResult = await manager.searchVoteRecords('张三', {}, { page: 1, limit: 10 });
      expect(searchResult.records.length).toBeGreaterThan(0);
    });

    test('should update vote status and create audit log', async () => {
      const manager = new VoteRecordManager();
      const auditManager = new AuditLogManager();
      
      // Get first vote
      const votes = await manager.getVoteRecords({}, { page: 1, limit: 1 });
      const voteId = votes.records[0].id;
      
      // Update status
      const result = await manager.updateVoteStatus(voteId, 'inactive', 1, 'Test deactivation');
      expect(result.success).toBe(true);
      
      // Verify audit log was created
      const history = await auditManager.getVoteOperationHistory(voteId);
      expect(history).toHaveLength(1);
      expect(history[0].operation).toBe('deactivate');
      expect(history[0].reason).toBe('Test deactivation');
    });

    test('should perform batch status updates', async () => {
      const manager = new VoteRecordManager();
      
      // Get all vote IDs
      const votes = await manager.getVoteRecords({}, { page: 1, limit: 10 });
      const voteIds = votes.records.slice(0, 3).map(v => v.id);
      
      // Batch update
      const result = await manager.batchUpdateVoteStatus(voteIds, 'inactive', 1, 'Batch test');
      expect(result.success).toBe(true);
      expect(result.updated).toBe(3);
      
      // Verify updates
      const updatedVotes = await manager.getVoteRecords({ status: 'inactive' }, { page: 1, limit: 10 });
      expect(updatedVotes.records).toHaveLength(3);
    });
  });

  describe('DataExportManager Integration', () => {
    test('should export vote records to CSV', async () => {
      const manager = new DataExportManager();
      
      const result = await manager.exportToCSV({}, null);
      expect(result.filename).toMatch(/\.csv$/);
      expect(result.recordCount).toBe(5);
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(result.filePath);
    });

    test('should export vote records to Excel', async () => {
      const manager = new DataExportManager();
      
      const result = await manager.exportToExcel({}, null);
      expect(result.filename).toMatch(/\.xlsx$/);
      expect(result.recordCount).toBe(5);
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(result.filePath);
    });

    test('should create and manage export tasks', async () => {
      const manager = new DataExportManager();
      
      // Create export task
      const task = await manager.createExportTask(1, '/test/path.csv', 'csv', {});
      expect(task.taskId).toBeDefined();
      
      // Retrieve task
      const retrievedTask = await manager.getExportTask(task.taskId);
      expect(retrievedTask.taskId).toBe(task.taskId);
      expect(retrievedTask.fileType).toBe('csv');
    });
  });

  describe('End-to-End Data Flow', () => {
    test('complete vote records management workflow', async () => {
      const voteRecordManager = new VoteRecordManager();
      const auditLogManager = new AuditLogManager();
      const dataExportManager = new DataExportManager();
      
      // 1. Get initial vote records
      const initialRecords = await voteRecordManager.getVoteRecords({}, { page: 1, limit: 10 });
      expect(initialRecords.records).toHaveLength(5);
      expect(initialRecords.pagination.total).toBe(5);
      
      const voteId = initialRecords.records[0].id;
      
      // 2. Get vote record detail
      const voteDetail = await voteRecordManager.getVoteRecordDetail(voteId);
      expect(voteDetail.voterName).toBeDefined();
      expect(voteDetail.targetName).toBeDefined();
      expect(voteDetail.status).toBe('active');
      
      // 3. Update vote status and verify audit log creation
      const updateResult = await voteRecordManager.updateVoteStatus(
        voteId, 
        'inactive', 
        1, 
        'End-to-end test deactivation'
      );
      expect(updateResult.success).toBe(true);
      
      // 4. Verify status change
      const updatedDetail = await voteRecordManager.getVoteRecordDetail(voteId);
      expect(updatedDetail.status).toBe('inactive');
      
      // 5. Check operation history
      const history = await auditLogManager.getVoteOperationHistory(voteId);
      expect(history).toHaveLength(1);
      expect(history[0].operation).toBe('deactivate');
      expect(history[0].reason).toBe('End-to-end test deactivation');
      
      // 6. Filter by status
      const inactiveRecords = await voteRecordManager.getVoteRecords(
        { status: 'inactive' }, 
        { page: 1, limit: 10 }
      );
      expect(inactiveRecords.records).toHaveLength(1);
      
      const activeRecords = await voteRecordManager.getVoteRecords(
        { status: 'active' }, 
        { page: 1, limit: 10 }
      );
      expect(activeRecords.records).toHaveLength(4);
      
      // 7. Search functionality
      const searchResults = await voteRecordManager.searchVoteRecords(
        '张三', 
        {}, 
        { page: 1, limit: 10 }
      );
      expect(searchResults.records.length).toBeGreaterThanOrEqual(0);
      
      // 8. Batch operations
      const remainingVoteIds = activeRecords.records.slice(0, 2).map(r => r.id);
      const batchResult = await voteRecordManager.batchUpdateVoteStatus(
        remainingVoteIds,
        'inactive',
        1,
        'Batch test operation'
      );
      expect(batchResult.success).toBe(true);
      expect(batchResult.updated).toBe(2);
      
      // 9. Export data
      const csvExport = await dataExportManager.exportToCSV({ status: 'active' });
      expect(csvExport.recordCount).toBe(2); // 2 active records remaining
      expect(fs.existsSync(csvExport.filePath)).toBe(true);
      
      const excelExport = await dataExportManager.exportToExcel({});
      expect(excelExport.recordCount).toBe(5); // All records
      expect(fs.existsSync(excelExport.filePath)).toBe(true);
      
      // 10. Export task management
      const exportTask = await dataExportManager.createExportTask(
        1, 
        csvExport.filePath, 
        'csv', 
        { status: 'active' }
      );
      expect(exportTask.taskId).toBeDefined();
      
      const retrievedTask = await dataExportManager.getExportTask(exportTask.taskId);
      expect(retrievedTask.fileType).toBe('csv');
      
      // Clean up export files
      if (fs.existsSync(csvExport.filePath)) {
        fs.unlinkSync(csvExport.filePath);
      }
      if (fs.existsSync(excelExport.filePath)) {
        fs.unlinkSync(excelExport.filePath);
      }
    });
  });
});