const { createUser, getAllUsers, clearAllData } = require('./src/database/operations');
const { initializeDatabase, runMigrations } = require('./src/database/init');

async function testNumericIdUniqueness() {
  console.log('🔧 初始化数据库...');
  await initializeDatabase();
  await runMigrations();
  
  console.log('🧹 清理测试数据...');
  await clearAllData();
  
  console.log('👥 创建多个用户测试数字ID唯一性...');
  
  const users = [];
  const numUsers = 15;
  
  // 创建多个用户
  for (let i = 0; i < numUsers; i++) {
    try {
      const user = await createUser({
        name: `测试用户${i + 1}`,
        gender: i % 2 === 0 ? 'male' : 'female'
      });
      users.push(user);
      console.log(`✅ 创建用户: ${user.name} (ID: ${user.numericId})`);
    } catch (error) {
      console.error(`❌ 创建用户失败: ${error.message}`);
    }
  }
  
  console.log('\n📊 数字ID唯一性检查:');
  
  // 提取所有数字ID
  const numericIds = users.map(user => user.numericId).filter(id => id !== null);
  const uniqueIds = new Set(numericIds);
  
  console.log(`总用户数: ${users.length}`);
  console.log(`数字ID数量: ${numericIds.length}`);
  console.log(`唯一ID数量: ${uniqueIds.size}`);
  
  if (uniqueIds.size === numericIds.length) {
    console.log('✅ 所有数字ID都是唯一的！');
  } else {
    console.log('❌ 发现重复的数字ID！');
    
    // 找出重复的ID
    const duplicates = [];
    const seen = new Set();
    numericIds.forEach(id => {
      if (seen.has(id)) {
        duplicates.push(id);
      } else {
        seen.add(id);
      }
    });
    console.log('重复的ID:', duplicates);
  }
  
  console.log('\n🔢 数字ID格式验证:');
  let validFormat = true;
  numericIds.forEach(id => {
    if (!/^\d{6}$/.test(id)) {
      console.log(`❌ 无效格式: ${id}`);
      validFormat = false;
    }
  });
  
  if (validFormat) {
    console.log('✅ 所有数字ID格式都正确 (6位数字)');
  }
  
  console.log('\n🏃‍♂️ 测试并发创建用户...');
  
  // 测试并发创建
  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    const promise = createUser({
      name: `并发用户${i + 1}`,
      gender: i % 2 === 0 ? 'male' : 'female'
    });
    concurrentPromises.push(promise);
  }
  
  try {
    const concurrentUsers = await Promise.all(concurrentPromises);
    const concurrentIds = concurrentUsers.map(u => u.numericId);
    const uniqueConcurrentIds = new Set(concurrentIds);
    
    console.log(`并发创建用户数: ${concurrentUsers.length}`);
    console.log(`并发唯一ID数: ${uniqueConcurrentIds.size}`);
    
    if (uniqueConcurrentIds.size === concurrentUsers.length) {
      console.log('✅ 并发创建测试通过！');
    } else {
      console.log('❌ 并发创建出现重复ID！');
    }
  } catch (error) {
    console.error('❌ 并发创建测试失败:', error.message);
  }
  
  console.log('\n📋 最终统计:');
  const allUsers = await getAllUsers();
  const allNumericIds = allUsers.map(u => u.numericId).filter(id => id !== null);
  const allUniqueIds = new Set(allNumericIds);
  
  console.log(`数据库中总用户数: ${allUsers.length}`);
  console.log(`总数字ID数: ${allNumericIds.length}`);
  console.log(`唯一ID数: ${allUniqueIds.size}`);
  
  if (allUniqueIds.size === allNumericIds.length) {
    console.log('🎉 数字ID唯一性测试完全通过！');
  } else {
    console.log('⚠️ 发现数字ID重复问题！');
  }
  
  console.log('\n🧹 清理测试数据...');
  await clearAllData();
  console.log('✅ 测试完成！');
}

// 运行测试
testNumericIdUniqueness().catch(console.error);