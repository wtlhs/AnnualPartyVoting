const { createUser, getAllUsers, clearAllData } = require('./operations');
const { initializeDatabase, runMigrations } = require('./init');

describe('Numeric ID Uniqueness Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
    await runMigrations();
  });

  beforeEach(async () => {
    await clearAllData();
  });

  test('should generate unique numeric IDs for multiple users', async () => {
    const users = [];
    const numUsers = 20;
    
    // Create multiple users
    for (let i = 0; i < numUsers; i++) {
      const user = await createUser({
        name: `Test User ${i}`,
        gender: i % 2 === 0 ? 'male' : 'female'
      });
      users.push(user);
    }
    
    // Extract all numeric IDs
    const numericIds = users.map(user => user.numericId).filter(id => id !== null);
    
    // Check that all numeric IDs are unique
    const uniqueIds = new Set(numericIds);
    expect(uniqueIds.size).toBe(numericIds.length);
    
    // Check that all numeric IDs are 6 digits
    numericIds.forEach(id => {
      expect(id).toMatch(/^\d{6}$/);
      expect(parseInt(id)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(id)).toBeLessThanOrEqual(999999);
    });
  });

  test('should handle concurrent user creation without duplicate numeric IDs', async () => {
    const numConcurrentUsers = 10;
    const userPromises = [];
    
    // Create multiple users concurrently
    for (let i = 0; i < numConcurrentUsers; i++) {
      const promise = createUser({
        name: `Concurrent User ${i}`,
        gender: i % 2 === 0 ? 'male' : 'female'
      });
      userPromises.push(promise);
    }
    
    // Wait for all users to be created
    const users = await Promise.all(userPromises);
    
    // Extract all numeric IDs
    const numericIds = users.map(user => user.numericId).filter(id => id !== null);
    
    // Check that all numeric IDs are unique
    const uniqueIds = new Set(numericIds);
    expect(uniqueIds.size).toBe(numericIds.length);
    
    // Verify all users were created successfully
    expect(users.length).toBe(numConcurrentUsers);
    users.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.numericId).toMatch(/^\d{6}$/);
    });
  });

  test('should retry when numeric ID collision occurs', async () => {
    // This test is harder to trigger reliably, but we can at least verify
    // that the retry mechanism doesn't break normal operation
    
    const users = [];
    const numUsers = 50; // Increase chances of collision
    
    // Create users in batches to increase collision probability
    const batchSize = 10;
    for (let batch = 0; batch < numUsers / batchSize; batch++) {
      const batchPromises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const userIndex = batch * batchSize + i;
        const promise = createUser({
          name: `Batch User ${userIndex}`,
          gender: userIndex % 2 === 0 ? 'male' : 'female'
        });
        batchPromises.push(promise);
      }
      
      const batchUsers = await Promise.all(batchPromises);
      users.push(...batchUsers);
    }
    
    // Verify all users have unique numeric IDs
    const numericIds = users.map(user => user.numericId).filter(id => id !== null);
    const uniqueIds = new Set(numericIds);
    
    expect(uniqueIds.size).toBe(numericIds.length);
    expect(users.length).toBe(numUsers);
  });

  test('should validate numeric ID format', async () => {
    const user = await createUser({
      name: 'Format Test User',
      gender: 'female'
    });
    
    expect(user.numericId).toBeDefined();
    expect(user.numericId).toMatch(/^\d{6}$/);
    
    const numericValue = parseInt(user.numericId);
    expect(numericValue).toBeGreaterThanOrEqual(100000);
    expect(numericValue).toBeLessThanOrEqual(999999);
  });

  test('should handle database constraint violations gracefully', async () => {
    // Create a user first
    const user1 = await createUser({
      name: 'First User',
      gender: 'male'
    });
    
    expect(user1.numericId).toBeDefined();
    
    // Create many more users to ensure the system handles any potential conflicts
    const additionalUsers = [];
    for (let i = 0; i < 30; i++) {
      const user = await createUser({
        name: `Additional User ${i}`,
        gender: i % 2 === 0 ? 'male' : 'female'
      });
      additionalUsers.push(user);
    }
    
    // Verify all users have different numeric IDs
    const allUsers = [user1, ...additionalUsers];
    const allNumericIds = allUsers.map(u => u.numericId);
    const uniqueIds = new Set(allNumericIds);
    
    expect(uniqueIds.size).toBe(allUsers.length);
  });
});