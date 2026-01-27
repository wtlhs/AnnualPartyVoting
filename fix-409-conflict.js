/**
 * 409 Conflict 错误修复工具
 * 提供多种解决方案来处理姓名冲突问题
 */

const { initializeDatabase } = require('./src/database/init');
const { getAllUsers, getUserByName, deleteUser, clearAllData } = require('./src/database/operations');

async function showConflictSolutions() {
  console.log('🔧 409 Conflict 错误解决方案\n');
  
  try {
    await initializeDatabase();
    const allUsers = await getAllUsers();
    
    console.log(`当前数据库中有 ${allUsers.length} 个用户:`);
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.gender}) - ${user.createdAt}`);
    });
    
    console.log('\n📋 可用的解决方案:\n');
    
    console.log('1️⃣ 使用不同的姓名注册');
    console.log('   - 在现有姓名后添加数字或标识符');
    console.log('   - 例如: "admin" → "admin2", "张三" → "张三_2"');
    
    console.log('\n2️⃣ 删除特定用户 (谨慎操作)');
    console.log('   - 删除不需要的重复用户');
    console.log('   - 会同时删除相关的投票数据');
    
    console.log('\n3️⃣ 清空所有数据 (重新开始)');
    console.log('   - 删除所有用户和投票数据');
    console.log('   - 适合测试环境或重新开始活动');
    
    console.log('\n4️⃣ 修改姓名验证逻辑 (开发选项)');
    console.log('   - 允许重复姓名但添加唯一标识');
    console.log('   - 需要修改代码逻辑');
    
    console.log('\n💡 推荐解决方案:');
    console.log('   - 生产环境: 使用方案1 (不同姓名)');
    console.log('   - 测试环境: 使用方案3 (清空数据)');
    
  } catch (error) {
    console.error('❌ 获取用户数据失败:', error.message);
  }
}

async function deleteSpecificUser(userName) {
  console.log(`🗑️ 删除用户: "${userName}"`);
  
  try {
    const user = await getUserByName(userName);
    if (!user) {
      console.log('❌ 用户不存在');
      return false;
    }
    
    console.log(`找到用户: ${user.name} (ID: ${user.id})`);
    console.log('⚠️ 警告: 这将删除用户及其所有相关数据 (投票记录等)');
    
    await deleteUser(user.id);
    console.log('✅ 用户删除成功');
    return true;
    
  } catch (error) {
    console.error('❌ 删除用户失败:', error.message);
    return false;
  }
}

async function clearAllUserData() {
  console.log('🧹 清空所有用户数据');
  
  try {
    const allUsers = await getAllUsers();
    console.log(`当前有 ${allUsers.length} 个用户`);
    
    if (allUsers.length === 0) {
      console.log('ℹ️ 数据库已经是空的');
      return;
    }
    
    console.log('⚠️ 警告: 这将删除所有用户、投票和相关数据');
    
    await clearAllData();
    console.log('✅ 所有数据清空成功');
    
  } catch (error) {
    console.error('❌ 清空数据失败:', error.message);
  }
}

async function suggestAlternativeNames(baseName) {
  console.log(`💡 为 "${baseName}" 建议替代姓名:\n`);
  
  const suggestions = [
    `${baseName}2`,
    `${baseName}_2`,
    `${baseName}01`,
    `新${baseName}`,
    `${baseName}A`,
    `${baseName}_new`
  ];
  
  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    try {
      const existing = await getUserByName(suggestion);
      if (existing) {
        console.log(`❌ ${suggestion} - 已被使用`);
      } else {
        console.log(`✅ ${suggestion} - 可用`);
      }
    } catch (error) {
      console.log(`⚠️ ${suggestion} - 检查失败`);
    }
  }
}

async function testRegistration(name, gender) {
  console.log(`🧪 测试注册: "${name}" (${gender})`);
  
  try {
    const existing = await getUserByName(name);
    if (existing) {
      console.log('❌ 注册会失败 - 姓名已存在');
      console.log(`   现有用户: ${existing.name} (${existing.gender})`);
      console.log(`   创建时间: ${existing.createdAt}`);
      return false;
    } else {
      console.log('✅ 注册会成功 - 姓名可用');
      return true;
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await showConflictSolutions();
  } else if (args[0] === 'delete' && args[1]) {
    await deleteSpecificUser(args[1]);
  } else if (args[0] === 'clear') {
    await clearAllUserData();
  } else if (args[0] === 'suggest' && args[1]) {
    await suggestAlternativeNames(args[1]);
  } else if (args[0] === 'test' && args[1] && args[2]) {
    await testRegistration(args[1], args[2]);
  } else {
    console.log('🔧 409 Conflict 错误修复工具\n');
    console.log('用法:');
    console.log('  node fix-409-conflict.js                    # 显示解决方案');
    console.log('  node fix-409-conflict.js delete "姓名"      # 删除特定用户');
    console.log('  node fix-409-conflict.js clear              # 清空所有数据');
    console.log('  node fix-409-conflict.js suggest "姓名"     # 建议替代姓名');
    console.log('  node fix-409-conflict.js test "姓名" "性别" # 测试注册');
    console.log('\n示例:');
    console.log('  node fix-409-conflict.js suggest "admin"');
    console.log('  node fix-409-conflict.js test "admin2" "male"');
    console.log('  node fix-409-conflict.js delete "admin"');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  showConflictSolutions, 
  deleteSpecificUser, 
  clearAllUserData, 
  suggestAlternativeNames, 
  testRegistration 
};