const { 
  createUser, 
  getAllUsers, 
  clearAllData,
  createDataBackup,
  archiveAndClearData,
  getDatabaseInfo,
  getAllVoteRestrictions
} = require('./operations');

const { initializeDatabase } = require('./init');

describe('Data Management Operations', () => {
  
  beforeEach(async () => {
    await initializeDatabase();
    await clearAllData();
  });

  afterAll(async () => {
    await clearAllData();
  });

  describe('createDataBackup', () => {
    test('should create complete backup with empty data', async () => {
      const backup = await createDataBackup();
      
      expect(backup).toHaveProperty('backupInfo');
      expect(backup).toHaveProperty('statistics');
      expect(backup).toHaveProperty('ranking');
      expect(backup).toHaveProperty('users');
      expect(backup).toHaveProperty('votes');
      expect(backup).toHaveProperty('voteRestrictions');
      expect(backup).toHaveProperty('winners');
      expect(backup).toHaveProperty('summary');
      
      expect(backup.backupInfo.version).toBe('1.0.0');
      expect(backup.users).toHaveLength(0);
      expect(backup.votes).toHaveLength(0);
      expect(backup.statistics.totalParticipants).toBe(0);
    });

    test('should create backup with user data', async () => {
      // Create test users
      const user1 = await createUser({
        name: '测试用户1',
        gender: 'male'
      });
      
      const user2 = await createUser({
        name: '测试用户2',
        gender: 'female'
      });
      
      const backup = await createDataBackup();
      
      expect(backup.users).toHaveLength(2);
      expect(backup.statistics.totalParticipants).toBe(2);
      expect(backup.statistics.maleParticipants).toBe(1);
      expect(backup.statistics.femaleParticipants).toBe(1);
      
      // Check user data structure
      const backupUser = backup.users.find(u => u.id === user1.id);
      expect(backupUser).toBeDefined();
      expect(backupUser.name).toBe('测试用户1');
      expect(backupUser.gender).toBe('male');
    });
  });

  describe('archiveAndClearData', () => {
    test('should archive data and clear database', async () => {
      // Create test data
      const user1 = await createUser({
        name: '测试用户1',
        gender: 'male'
      });
      
      const user2 = await createUser({
        name: '测试用户2',
        gender: 'female'
      });
      
      // Verify data exists
      const usersBefore = await getAllUsers();
      expect(usersBefore).toHaveLength(2);
      
      // Archive and clear
      const result = await archiveAndClearData(false); // Don't include files in test
      
      expect(result.success).toBe(true);
      expect(result.backup).toBeDefined();
      expect(result.backup.users).toHaveLength(2);
      
      // Verify data is cleared
      const usersAfter = await getAllUsers();
      expect(usersAfter).toHaveLength(0);
    });
  });

  describe('getDatabaseInfo', () => {
    test('should return database information', async () => {
      const info = await getDatabaseInfo();
      
      expect(info).toHaveProperty('database');
      expect(info).toHaveProperty('uploads');
      expect(info).toHaveProperty('dataInfo');
      expect(info).toHaveProperty('lastUpdated');
      
      expect(info.database).toHaveProperty('fileExists');
      expect(info.database).toHaveProperty('filePath');
      expect(info.database).toHaveProperty('fileSize');
      expect(info.database).toHaveProperty('fileSizeFormatted');
      
      expect(info.dataInfo.totalUsers).toBe(0);
      expect(info.dataInfo.totalVotes).toBe(0);
    });

    test('should return correct data counts', async () => {
      // Create test users
      await createUser({ name: '用户1', gender: 'male' });
      await createUser({ name: '用户2', gender: 'female' });
      await createUser({ name: '用户3', gender: 'male' });
      
      const info = await getDatabaseInfo();
      
      expect(info.dataInfo.totalUsers).toBe(3);
      expect(info.dataInfo.totalParticipants).toBe(3);
      expect(info.dataInfo.maleParticipants).toBe(2);
      expect(info.dataInfo.femaleParticipants).toBe(1);
    });
  });

  describe('getAllVoteRestrictions', () => {
    test('should return empty array when no restrictions exist', async () => {
      const restrictions = await getAllVoteRestrictions();
      expect(restrictions).toHaveLength(0);
    });
  });

  describe('Data integrity after operations', () => {
    test('should maintain data consistency during backup operations', async () => {
      // Create test data
      const users = [];
      for (let i = 1; i <= 5; i++) {
        const user = await createUser({
          name: `用户${i}`,
          gender: i % 2 === 0 ? 'female' : 'male'
        });
        users.push(user);
      }
      
      // Create backup
      const backup1 = await createDataBackup();
      
      // Verify data still exists after backup
      const usersAfterBackup = await getAllUsers();
      expect(usersAfterBackup).toHaveLength(5);
      
      // Create another backup
      const backup2 = await createDataBackup();
      
      // Both backups should be identical
      expect(backup1.users).toHaveLength(backup2.users.length);
      expect(backup1.statistics.totalParticipants).toBe(backup2.statistics.totalParticipants);
    });
  });
});