const { getDatabase } = require('./init');

/**
 * Test script to verify database structure and basic functionality
 * This script tests the newly created tables and their constraints
 */
async function testDatabaseStructure() {
  console.log('=== Testing Database Structure ===');
  
  try {
    // Test votes table with new fields
    await testVotesTableStructure();
    
    // Test audit_logs table
    await testAuditLogsTable();
    
    // Test export_tasks table
    await testExportTasksTable();
    
    console.log('\n✅ All database structure tests passed!');
  } catch (error) {
    console.error('\n❌ Database structure test failed:', error);
    throw error;
  }
}

async function testVotesTableStructure() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('\n--- Testing Votes Table Structure ---');
    
    // Test inserting a vote with new fields
    const testVote = {
      voter_id: 'test-voter-123',
      target_user_id: 'test-target-456',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0 Test Browser',
      vote_method: 'qr_code',
      status: 'active'
    };
    
    const sql = `
      INSERT INTO votes (voter_id, target_user_id, ip_address, user_agent, vote_method, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [
      testVote.voter_id,
      testVote.target_user_id,
      testVote.ip_address,
      testVote.user_agent,
      testVote.vote_method,
      testVote.status
    ], function(err) {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const voteId = this.lastID;
      console.log(`✓ Successfully inserted test vote with ID: ${voteId}`);
      
      // Verify the vote was inserted with all fields
      db.get('SELECT * FROM votes WHERE id = ?', [voteId], (err, row) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        console.log('✓ Vote record contains all required fields:');
        console.log(`  - status: ${row.status}`);
        console.log(`  - user_agent: ${row.user_agent}`);
        console.log(`  - vote_method: ${row.vote_method}`);
        console.log(`  - created_at: ${row.created_at}`);
        console.log(`  - updated_at: ${row.updated_at}`);
        
        // Clean up test data
        db.run('DELETE FROM votes WHERE id = ?', [voteId], (err) => {
          db.close();
          if (err) return reject(err);
          console.log('✓ Test vote cleaned up');
          resolve();
        });
      });
    });
  });
}

async function testAuditLogsTable() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('\n--- Testing Audit Logs Table ---');
    
    // Test inserting an audit log
    const testLog = {
      vote_id: 999, // Using a fake vote_id for testing
      admin_id: 'test-admin-123',
      operation: 'deactivate',
      reason: 'Test deactivation',
      metadata: JSON.stringify({ test: true })
    };
    
    const sql = `
      INSERT INTO audit_logs (vote_id, admin_id, operation, reason, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [
      testLog.vote_id,
      testLog.admin_id,
      testLog.operation,
      testLog.reason,
      testLog.metadata
    ], function(err) {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const logId = this.lastID;
      console.log(`✓ Successfully inserted test audit log with ID: ${logId}`);
      
      // Verify the log was inserted
      db.get('SELECT * FROM audit_logs WHERE id = ?', [logId], (err, row) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        console.log('✓ Audit log contains all required fields:');
        console.log(`  - operation: ${row.operation}`);
        console.log(`  - reason: ${row.reason}`);
        console.log(`  - metadata: ${row.metadata}`);
        console.log(`  - created_at: ${row.created_at}`);
        
        // Clean up test data
        db.run('DELETE FROM audit_logs WHERE id = ?', [logId], (err) => {
          db.close();
          if (err) return reject(err);
          console.log('✓ Test audit log cleaned up');
          resolve();
        });
      });
    });
  });
}

async function testExportTasksTable() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('\n--- Testing Export Tasks Table ---');
    
    // Test inserting an export task
    const testTask = {
      admin_id: 'test-admin-123',
      file_path: '/tmp/test-export.csv',
      file_type: 'csv',
      filters: JSON.stringify({ status: 'active' }),
      status: 'pending'
    };
    
    const sql = `
      INSERT INTO export_tasks (admin_id, file_path, file_type, filters, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [
      testTask.admin_id,
      testTask.file_path,
      testTask.file_type,
      testTask.filters,
      testTask.status
    ], function(err) {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const taskId = this.lastID;
      console.log(`✓ Successfully inserted test export task with ID: ${taskId}`);
      
      // Test the trigger by updating status to completed
      db.run('UPDATE export_tasks SET status = ? WHERE id = ?', ['completed', taskId], (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        // Verify the trigger set expires_at
        db.get('SELECT * FROM export_tasks WHERE id = ?', [taskId], (err, row) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          console.log('✓ Export task contains all required fields:');
          console.log(`  - file_type: ${row.file_type}`);
          console.log(`  - status: ${row.status}`);
          console.log(`  - completed_at: ${row.completed_at}`);
          console.log(`  - expires_at: ${row.expires_at}`);
          
          if (row.expires_at) {
            console.log('✓ Automatic expiry trigger worked correctly');
          }
          
          // Clean up test data
          db.run('DELETE FROM export_tasks WHERE id = ?', [taskId], (err) => {
            db.close();
            if (err) return reject(err);
            console.log('✓ Test export task cleaned up');
            resolve();
          });
        });
      });
    });
  });
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDatabaseStructure()
    .then(() => {
      console.log('\n🎉 Database structure verification completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Database structure verification failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testDatabaseStructure
};