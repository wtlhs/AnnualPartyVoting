/**
 * 更新IP地址迁移脚本：将所有用户的二维码URL从172.18.0.250更新为192.168.0.97
 */

const { getAllUsers, updateUser } = require('./src/database/operations');
const { generateCompleteQRCode } = require('./src/utils/qrcode');

async function updateIPQRCodes() {
  console.log('🔄 开始更新IP地址...');
  
  try {
    // 获取所有用户
    const users = await getAllUsers();
    console.log(`📊 找到 ${users.length} 个用户`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        console.log(`\n处理用户: ${user.name} (ID: ${user.id})`);
        
        // 检查是否有二维码
        if (!user.qrCode) {
          console.log('  ⚠️  用户没有二维码，跳过');
          skippedCount++;
          continue;
        }
        
        // 检查是否包含旧IP地址
        if (!user.qrCode.includes('172.18.0.250')) {
          console.log('  ✅ 用户二维码不包含旧IP地址，跳过');
          skippedCount++;
          continue;
        }
        
        console.log('  🔄 检测到旧IP地址，重新生成二维码...');
        
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
        
        console.log('  ✅ IP地址更新成功');
        console.log(`  📱 新投票URL: ${qrData}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`  ❌ 更新用户 ${user.name} 失败:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 IP地址更新完成统计:');
    console.log(`✅ 成功更新: ${updatedCount} 个用户`);
    console.log(`⏭️  跳过: ${skippedCount} 个用户`);
    console.log(`❌ 失败: ${errorCount} 个用户`);
    console.log(`📊 总计: ${users.length} 个用户`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 IP地址更新完成！现在所有用户的二维码都使用新的IP地址 192.168.0.97。');
      console.log('💡 用户扫描二维码后将跳转到新的IP地址。');
    } else {
      console.log('\n💡 没有需要更新的用户。');
    }
    
  } catch (error) {
    console.error('❌ 更新过程中发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateIPQRCodes()
    .then(() => {
      console.log('\n✅ IP地址更新脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ IP地址更新脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { updateIPQRCodes };