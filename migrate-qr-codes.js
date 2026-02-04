/**
 * 迁移脚本：将现有用户的个人信息二维码更新为投票URL二维码
 * 
 * 这个脚本会：
 * 1. 查找所有使用旧JSON格式二维码的用户
 * 2. 为每个用户生成新的投票URL二维码
 * 3. 更新数据库中的二维码数据
 */

const { getAllUsers, updateUser } = require('./src/database/operations');
const { generateCompleteQRCode } = require('./src/utils/qrcode');

async function migrateQRCodes() {
  console.log('🔄 开始迁移用户二维码...');
  
  try {
    // 获取所有用户
    const users = await getAllUsers();
    console.log(`📊 找到 ${users.length} 个用户`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        console.log(`\n处理用户: ${user.name} (ID: ${user.id})`);
        
        // 检查是否需要迁移
        if (!user.qrCode) {
          console.log('  ⚠️  用户没有二维码，跳过');
          skippedCount++;
          continue;
        }
        
        // 检查是否已经是新格式（URL格式）
        if (user.qrCode.startsWith('http')) {
          console.log('  ✅ 用户已使用新格式二维码，跳过');
          skippedCount++;
          continue;
        }
        
        // 尝试解析旧格式的JSON数据
        let oldData;
        try {
          oldData = JSON.parse(user.qrCode);
          console.log('  📄 检测到旧JSON格式二维码');
        } catch (parseError) {
          console.log('  ❌ 无法解析二维码数据，跳过');
          skippedCount++;
          continue;
        }
        
        // 生成新的投票URL二维码
        console.log('  🔄 生成新的投票URL二维码...');
        
        // 获取其他用户的二维码以确保唯一性
        const otherUsers = users.filter(u => u.id !== user.id && u.qrCode);
        const existingQRCodes = otherUsers.map(u => u.qrCode);
        
        const { qrData, qrCodeImage } = await generateCompleteQRCode(
          {
            userId: user.id,
            name: user.name,
            gender: user.gender
          },
          existingQRCodes
        );
        
        // 更新用户数据
        await updateUser(user.id, {
          qrCode: qrData
        });
        
        console.log('  ✅ 迁移成功');
        console.log(`  📱 新投票URL: ${qrData}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`  ❌ 迁移用户 ${user.name} 失败:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 迁移完成统计:');
    console.log(`✅ 成功迁移: ${migratedCount} 个用户`);
    console.log(`⏭️  跳过: ${skippedCount} 个用户`);
    console.log(`❌ 失败: ${errorCount} 个用户`);
    console.log(`📊 总计: ${users.length} 个用户`);
    
    if (migratedCount > 0) {
      console.log('\n🎉 迁移完成！现在所有用户的二维码都是投票URL格式。');
      console.log('💡 用户扫描二维码后将直接跳转到投票页面。');
    } else {
      console.log('\n💡 没有需要迁移的用户。');
    }
    
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateQRCodes()
    .then(() => {
      console.log('\n✅ 迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { migrateQRCodes };