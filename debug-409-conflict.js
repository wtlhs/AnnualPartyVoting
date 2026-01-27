/**
 * 409 Conflict 错误诊断工具
 * 检查数据库中的重复姓名和提供解决方案
 */

const { initializeDatabase } = require('./src/database/init');
const { getAllUsers, getUserByName, deleteUser } = require('./src/database/operations');

async function diagnose409Conflict() {
  console.log('🔍 开始诊断409 Conflict错误...\n');
  
  try {
    await initializeDatabase();
    console.log('✅ 数据库连接成功\n');
    
    // 获取所有用户
    const allUsers = await getAllUsers();
    console.log(`📊 数据库中共有 ${allUsers.length} 个用户\n`);
    
    if (allUsers.length === 0) {
      console.log('ℹ️ 数据库为空，没有用户数据');
      return;
    }
    
    // 检查重复姓名
    const nameCount = {};
    const duplicateNames = [];
    
    allUsers.forEach(user => {
      const name = user.name.toLowerCase().trim();
      if (nameCount[name]) {
        nameCount[name]++;
        if (nameCount[name] === 2) {
          duplicateNames.push(name);
        }
      } else {
        nameCount[name] = 1;
      }
    });
    
    if (duplicateNames.length > 0) {
      console.log('❌ 发现重复姓名:');
      for (const name of duplicateNames) {
        const users = allUsers.filter(u => u.name.toLowerCase().trim() === name);
        console.log(`\n📝 姓名: "${users[0].name}" (重复 ${nameCount[name]} 次)`);
        users.forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id}, 创建时间: ${user.createdAt}, 性别: ${user.gender}`);
        });
      }
      
      console.log('\n💡 解决方案:');
      console.log('1. 删除重复的用户记录');
      console.log('2. 修改重复的姓名');
      console.log('3. 清空所有数据重新开始');
      
    } else {
      console.log('✅ 没有发现重复姓名');
    }
    
    // 显示所有用户列表
    console.log('\n📋 当前用户列表:');
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.gender}) - ID: ${user.id.substring(0, 8)}...`);
    });
    
    // 检查最近的注册尝试
    console.log('\n🕒 最近注册的用户:');
    const recentUsers = allUsers
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    recentUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} - ${user.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ 诊断过程中出错:', error.message);
  }
}

async function testNameConflict(testName) {
  console.log(`\n🧪 测试姓名冲突: "${testName}"`);
  
  try {
    const existingUser = await getUserByName(testName);
    if (existingUser) {
      console.log('❌ 姓名已存在，会导致409错误');
      console.log(`   现有用户: ID ${existingUser.id}, 创建时间: ${existingUser.createdAt}`);
      return true;
    } else {
      console.log('✅ 姓名可用，不会导致冲突');
      return false;
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }
}

async function cleanupDuplicates() {
  console.log('\n🧹 开始清理重复数据...');
  
  try {
    const allUsers = await getAllUsers();
    const nameGroups = {};
    
    // 按姓名分组
    allUsers.forEach(user => {
      const name = user.name.toLowerCase().trim();
      if (!nameGroups[name]) {
        nameGroups[name] = [];
      }
      nameGroups[name].push(user);
    });
    
    let deletedCount = 0;
    
    // 删除重复项（保留最早创建的）
    for (const [name, users] of Object.entries(nameGroups)) {
      if (users.length > 1) {
        // 按创建时间排序，保留最早的
        users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const toKeep = users[0];
        const toDelete = users.slice(1);
        
        console.log(`\n📝 处理重复姓名: "${toKeep.name}"`);
        console.log(`   保留: ID ${toKeep.id} (${toKeep.createdAt})`);
        
        for (const user of toDelete) {
          try {
            await deleteUser(user.id);
            console.log(`   删除: ID ${user.id} (${user.createdAt})`);
            deletedCount++;
          } catch (error) {
            console.error(`   删除失败: ${error.message}`);
          }
        }
      }
    }
    
    console.log(`\n✅ 清理完成，删除了 ${deletedCount} 个重复用户`);
    
  } catch (error) {
    console.error('❌ 清理过程中出错:', error.message);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await diagnose409Conflict();
  } else if (args[0] === 'test' && args[1]) {
    await testNameConflict(args[1]);
  } else if (args[0] === 'cleanup') {
    await cleanupDuplicates();
  } else {
    console.log('用法:');
    console.log('  node debug-409-conflict.js              # 诊断冲突');
    console.log('  node debug-409-conflict.js test "姓名"   # 测试特定姓名');
    console.log('  node debug-409-conflict.js cleanup       # 清理重复数据');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { diagnose409Conflict, testNameConflict, cleanupDuplicates };