const fs = require('fs');
const path = require('path');
const request = require('supertest');

// Import the main app
const app = require('../../server');

// Import managers for direct testing
const VoteRecordManager = require('./VoteRecordManager');
const AuditLogManager = require('./AuditLogManager');
const DataExportManager = require('./DataExportManager');

// Import operations
const { createUser, recordVote, clearAllData, getVoteStatistics, getRanking } = require('./operations');

describe('End-to-End Vote Records Management', () => {
  let testUsers = [];
  let testVotes = [];
  let adminToken = 'test-admin-token';
  
  beforeAll(async () => {
    // Initialize test database by running migrations
    const { runMigrations } = require('./migrationRunner');
    await runMigrations();
  });

  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
    
    // Create test users with realistic data
    testUsers = [
      await createUser({ name: '张三', gender: 'male' }),
      await createUser({ name: '李四', gender: 'male' }),
      await createUser({ name: '王五', gender: 'female' }),
      await createUser({ name: '赵六', gender: 'female' }),
      await createUser({ name: '陈七', gender: 'male' }),
      await createUser({ name: '刘八', gender: 'female' })
    ];
    
    // Create realistic voting scenario
    testVotes = [];
    const votingScenarios = [
      { voterId: testUsers[0].id, targetId: testUsers[2].id, method: 'qr_code' },
      { voterId: testUsers[0].id, targetId: testUsers[4].id, method: 'qr_code' },
      { voterId: testUsers[1].id, targetId: testUsers[2].id, method: 'name_search' },
      { voterId: testUsers[1].id, targetId: testUsers[4].id, method: 'name_search' },
      { voterId: testUsers[3].id, targetId: testUsers[0].id, method: 'qr_code' },
      { voterId: testUsers[3].id, targetId: testUsers[5].id, method: 'qr_code' },
      { voterId: testUsers[5].id, targetId: testUsers[1].id, method: 'name_search' },
      { voterId: testUsers[5].id, targetId: testUsers[2].id, method: 'name_search' },
      // Anonymous votes
      { voterId: null, targetId: testUsers[0].id, method: 'anonymous' },
      { voterId: null, targetId: testUsers[2].id, method: 'anonymous' }
    ];
    
    for (let i = 0; i < votingScenarios.length; i++) {
      const scenario = votingScenarios[i];
      const vote = await recordVote({
        voterId: scenario.voterId,
        targetUserId: scenario.targetId,
        ipAddress: `192.168.1.${i + 10}`,
        userAgent: `Test Browser ${i + 1}`,
        voteMethod: scenario.method
      });
      testVotes.push(vote);
    }
  });

  afterAll(async () => {
    // Clean up test database
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const testDbPath = path.join(__dirname, '../../data/voting.db');
      // Don't delete the main database, just clean up any test files
    } catch (error) {
      console.warn('Could not clean up test files:', error.message);
    }
  });

  describe('Complete User Workflow Simulation', () => {
    test('admin manages vote records through complete workflow', async () => {
      const voteRecordManager = new VoteRecordManager();
      const auditLogManager = new AuditLogManager();
      const dataExportManager = new DataExportManager();
      
      // Step 1: Admin views initial vote records
      console.log('Step 1: Viewing initial vote records...');
      const initialRecords = await voteRecordManager.getVoteRecords({}, { page: 1, limit: 20 });
      expect(initialRecords.records).toHaveLength(10);
      expect(initialRecords.pagination.total).toBe(10);
      
      // Verify all votes are initially active
      const activeVotes = initialRecords.records.filter(r => r.status === 'active');
      expect(activeVotes).toHaveLength(10);
      
      // Step 2: Admin searches for specific voter
      console.log('Step 2: Searching for specific voter...');
      const searchResults = await voteRecordManager.searchVoteRecords('张三', {}, { page: 1, limit: 10 });
      expect(searchResults.records.length).toBeGreaterThan(0);
      
      // Verify search results contain the expected voter
      const zhangSanVotes = searchResults.records.filter(r => 
        r.voterName && r.voterName.includes('张三')
      );
      expect(zhangSanVotes.length).toBeGreaterThan(0);
      
      // Step 3: Admin filters by vote method
      console.log('Step 3: Filtering by vote method...');
      const qrCodeVotes = await voteRecordManager.getVoteRecords(
        { voteMethod: 'qr_code' }, 
        { page: 1, limit: 10 }
      );
      expect(qrCodeVotes.records.length).toBeGreaterThan(0);
      
      // Verify all results have the correct vote method
      qrCodeVotes.records.forEach(vote => {
        expect(vote.voteMethod).toBe('qr_code');
      });
      
      // Step 4: Admin examines vote record details
      console.log('Step 4: Examining vote record details...');
      const firstVoteId = initialRecords.records[0].id;
      const voteDetail = await voteRecordManager.getVoteRecordDetail(firstVoteId);
      
      expect(voteDetail).toBeDefined();
      expect(voteDetail.id).toBe(firstVoteId);
      expect(voteDetail.targetName).toBeDefined();
      expect(voteDetail.status).toBe('active');
      expect(voteDetail.ipAddress).toBeDefined();
      expect(voteDetail.voteMethod).toBeDefined();
      
      // Step 5: Admin deactivates a suspicious vote
      console.log('Step 5: Deactivating suspicious vote...');
      const suspiciousVoteId = initialRecords.records[1].id;
      const deactivateResult = await voteRecordManager.updateVoteStatus(
        suspiciousVoteId,
        'inactive',
        1,
        'Suspicious voting pattern detected'
      );
      
      expect(deactivateResult.success).toBe(true);
      expect(deactivateResult.newStatus).toBe('inactive');
      
      // Verify the vote is now inactive
      const deactivatedVote = await voteRecordManager.getVoteRecordDetail(suspiciousVoteId);
      expect(deactivatedVote.status).toBe('inactive');
      
      // Step 6: Admin checks operation history
      console.log('Step 6: Checking operation history...');
      const operationHistory = await auditLogManager.getVoteOperationHistory(suspiciousVoteId);
      expect(operationHistory).toHaveLength(1);
      expect(operationHistory[0].operation).toBe('deactivate');
      expect(operationHistory[0].reason).toBe('Suspicious voting pattern detected');
      expect(operationHistory[0].adminId).toBe(1);
      
      // Step 7: Admin performs batch operations
      console.log('Step 7: Performing batch operations...');
      const votesToBatchDeactivate = initialRecords.records.slice(2, 5).map(r => r.id);
      const batchResult = await voteRecordManager.batchUpdateVoteStatus(
        votesToBatchDeactivate,
        'inactive',
        1,
        'Batch cleanup operation'
      );
      
      expect(batchResult.success).toBe(true);
      expect(batchResult.updated).toBe(3);
      
      // Verify batch operation results
      const inactiveVotes = await voteRecordManager.getVoteRecords(
        { status: 'inactive' },
        { page: 1, limit: 10 }
      );
      expect(inactiveVotes.records).toHaveLength(4); // 1 + 3 from batch
      
      // Step 8: Admin restores a vote
      console.log('Step 8: Restoring a vote...');
      const voteToRestore = inactiveVotes.records[0].id;
      const restoreResult = await voteRecordManager.updateVoteStatus(
        voteToRestore,
        'active',
        1,
        'False positive - restoring vote'
      );
      
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.newStatus).toBe('active');
      
      // Verify restoration
      const restoredVote = await voteRecordManager.getVoteRecordDetail(voteToRestore);
      expect(restoredVote.status).toBe('active');
      
      // Check updated operation history
      const updatedHistory = await auditLogManager.getVoteOperationHistory(voteToRestore);
      expect(updatedHistory).toHaveLength(2);
      expect(updatedHistory[0].operation).toBe('activate'); // Most recent first
      expect(updatedHistory[1].operation).toBe('deactivate');
      
      // Step 9: Admin exports filtered data
      console.log('Step 9: Exporting filtered data...');
      const csvExport = await dataExportManager.exportToCSV(
        { status: 'active' },
        ['voterName', 'targetName', 'voteMethod', 'createdAt', 'status']
      );
      
      expect(csvExport.recordCount).toBe(7); // 10 - 4 + 1 restored
      expect(fs.existsSync(csvExport.filePath)).toBe(true);
      
      // Verify CSV content
      const csvContent = fs.readFileSync(csvExport.filePath, 'utf8');
      expect(csvContent).toContain('投票者姓名');
      expect(csvContent).toContain('被投票者姓名');
      expect(csvContent).toContain('active');
      
      // Step 10: Admin exports all data to Excel
      console.log('Step 10: Exporting all data to Excel...');
      const excelExport = await dataExportManager.exportToExcel({}, null);
      expect(excelExport.recordCount).toBe(10); // All records
      expect(fs.existsSync(excelExport.filePath)).toBe(true);
      
      // Step 11: Admin creates export task
      console.log('Step 11: Creating export task...');
      const exportTask = await dataExportManager.createExportTask(
        1,
        csvExport.filePath,
        'csv',
        { status: 'active' }
      );
      
      expect(exportTask.taskId).toBeDefined();
      expect(exportTask.fileType).toBe('csv');
      
      // Step 12: Verify data consistency
      console.log('Step 12: Verifying data consistency...');
      const finalActiveVotes = await voteRecordManager.getVoteRecords(
        { status: 'active' },
        { page: 1, limit: 20 }
      );
      const finalInactiveVotes = await voteRecordManager.getVoteRecords(
        { status: 'inactive' },
        { page: 1, limit: 20 }
      );
      
      expect(finalActiveVotes.records).toHaveLength(7);
      expect(finalInactiveVotes.records).toHaveLength(3);
      expect(finalActiveVotes.records.length + finalInactiveVotes.records.length).toBe(10);
      
      // Verify vote statistics are consistent
      const statistics = await getVoteStatistics();
      expect(statistics.totalVotes).toBe(10);
      
      // Clean up export files
      if (fs.existsSync(csvExport.filePath)) {
        fs.unlinkSync(csvExport.filePath);
      }
      if (fs.existsSync(excelExport.filePath)) {
        fs.unlinkSync(excelExport.filePath);
      }
      
      console.log('Complete workflow test passed successfully!');
    });
  });

  describe('Data Consistency Verification', () => {
    test('vote status changes maintain data integrity', async () => {
      const voteRecordManager = new VoteRecordManager();
      
      // Get initial statistics
      const initialStats = await getVoteStatistics();
      const initialRanking = await getRanking();
      
      // Deactivate some votes
      const votesToDeactivate = testVotes.slice(0, 3).map(v => v.id);
      await voteRecordManager.batchUpdateVoteStatus(
        votesToDeactivate,
        'inactive',
        1,
        'Data consistency test'
      );
      
      // Verify statistics are updated (this depends on how statistics are calculated)
      const updatedStats = await getVoteStatistics();
      expect(updatedStats.totalVotes).toBe(initialStats.totalVotes); // Total votes shouldn't change
      
      // Verify ranking reflects active votes only (if implemented)
      const updatedRanking = await getRanking();
      expect(updatedRanking).toBeDefined();
      
      // Restore votes and verify consistency
      await voteRecordManager.batchUpdateVoteStatus(
        votesToDeactivate,
        'active',
        1,
        'Restore for consistency test'
      );
      
      const finalStats = await getVoteStatistics();
      expect(finalStats.totalVotes).toBe(initialStats.totalVotes);
    });

    test('concurrent operations maintain data integrity', async () => {
      const voteRecordManager = new VoteRecordManager();
      
      // Simulate concurrent operations
      const voteId1 = testVotes[0].id;
      const voteId2 = testVotes[1].id;
      
      const operations = [
        voteRecordManager.updateVoteStatus(voteId1, 'inactive', 1, 'Concurrent test 1'),
        voteRecordManager.updateVoteStatus(voteId2, 'inactive', 2, 'Concurrent test 2')
      ];
      
      const results = await Promise.all(operations);
      
      // Verify both operations succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Verify final state
      const vote1 = await voteRecordManager.getVoteRecordDetail(voteId1);
      const vote2 = await voteRecordManager.getVoteRecordDetail(voteId2);
      
      expect(vote1.status).toBe('inactive');
      expect(vote2.status).toBe('inactive');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles invalid vote IDs gracefully', async () => {
      const voteRecordManager = new VoteRecordManager();
      
      // Test with non-existent vote ID
      const nonExistentVote = await voteRecordManager.getVoteRecordDetail(99999);
      expect(nonExistentVote).toBeNull();
      
      // Test update with non-existent vote ID
      await expect(
        voteRecordManager.updateVoteStatus(99999, 'inactive', 1, 'Test')
      ).rejects.toThrow('投票记录不存在');
    });

    test('handles invalid status values', async () => {
      const voteRecordManager = new VoteRecordManager();
      const voteId = testVotes[0].id;
      
      // Test with invalid status
      await expect(
        voteRecordManager.updateVoteStatus(voteId, 'invalid_status', 1, 'Test')
      ).rejects.toThrow('状态值必须是 active 或 inactive');
    });

    test('handles empty batch operations', async () => {
      const voteRecordManager = new VoteRecordManager();
      
      // Test with empty array
      await expect(
        voteRecordManager.batchUpdateVoteStatus([], 'inactive', 1, 'Test')
      ).rejects.toThrow('投票记录ID数组不能为空');
    });

    test('handles export with no data', async () => {
      const dataExportManager = new DataExportManager();
      
      // Clear all data first
      await clearAllData();
      
      // Try to export with no data
      await expect(
        dataExportManager.exportToCSV({}, null)
      ).rejects.toThrow('没有符合条件的数据可以导出');
    });
  });

  describe('Performance and Scalability', () => {
    test('handles large batch operations efficiently', async () => {
      const voteRecordManager = new VoteRecordManager();
      
      // Create additional test votes for batch testing
      const additionalVotes = [];
      for (let i = 0; i < 20; i++) {
        const vote = await recordVote({
          voterId: testUsers[i % testUsers.length].id,
          targetUserId: testUsers[(i + 1) % testUsers.length].id,
          ipAddress: `192.168.2.${i + 1}`,
          userAgent: `Batch Test Browser ${i}`,
          voteMethod: 'qr_code'
        });
        additionalVotes.push(vote);
      }
      
      const startTime = Date.now();
      
      // Batch update all additional votes
      const batchResult = await voteRecordManager.batchUpdateVoteStatus(
        additionalVotes.map(v => v.id),
        'inactive',
        1,
        'Performance test batch operation'
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(batchResult.success).toBe(true);
      expect(batchResult.updated).toBe(20);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log(`Batch operation of 20 votes completed in ${duration}ms`);
    });

    test('pagination works correctly with large datasets', async () => {
      const voteRecordManager = new VoteRecordManager();
      
      // Test pagination with current dataset
      const page1 = await voteRecordManager.getVoteRecords({}, { page: 1, limit: 5 });
      const page2 = await voteRecordManager.getVoteRecords({}, { page: 2, limit: 5 });
      
      expect(page1.records).toHaveLength(5);
      expect(page2.records).toHaveLength(5);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page2.pagination.hasPrev).toBe(true);
      
      // Verify no duplicate records between pages
      const page1Ids = page1.records.map(r => r.id);
      const page2Ids = page2.records.map(r => r.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });
});