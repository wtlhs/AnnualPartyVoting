/**
 * 测试二维码修复是否有效
 */

const { getUserById } = require('./src/database/operations');
const { validateQRData, generateQRCodeImage } = require('./src/utils/qrcode');

async function testQRCodeFix() {
  console.log('=== 测试二维码修复 ===');
  
  try {
    // 获取一个已迁移的用户
    const user = await getUserById('652fd327-5fd5-4f71-9bd4-e24caa5e2499'); // 王天龙
    
    if (!user) {
      console.log('❌ 用户不存在');
      return;
    }
    
    console.log(`📋 测试用户: ${user.name} (ID: ${user.id})`);
    console.log(`📄 二维码数据: ${user.qrCode.substring(0, 100)}...`);
    
    // 测试新的验证逻辑
    if (user.qrCode.startsWith('http')) {
      console.log('✅ 检测到URL格式二维码');
      
      try {
        // 验证URL格式
        const validatedData = validateQRData(user.qrCode);
        console.log('✅ URL验证通过');
        console.log(`   候选人ID: ${validatedData.candidateId}`);
        console.log(`   候选人姓名: ${validatedData.candidateName}`);
        
        // 生成二维码图片
        const qrImage = await generateQRCodeImage(user.qrCode);
        console.log('✅ 二维码图片生成成功');
        console.log(`   图片大小: ${qrImage.length} 字符`);
        
      } catch (error) {
        console.error('❌ 验证或生成失败:', error.message);
      }
      
    } else {
      console.log('⚠️  检测到旧格式二维码，需要重新生成');
    }
    
    console.log('\n🎉 测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testQRCodeFix();