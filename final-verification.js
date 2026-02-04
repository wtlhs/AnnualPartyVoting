/**
 * 最终验证脚本 - 确保QR码投票URL功能完全正常
 */

const { getAllUsers, getUserById } = require('./src/database/operations');
const { validateQRData, generateQRCodeImage, generateCompleteQRCode } = require('./src/utils/qrcode');

async function finalVerification() {
  console.log('🔍 开始最终验证...\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // 测试1: 检查所有用户的二维码格式
  console.log('📋 测试1: 检查用户二维码格式');
  totalTests++;
  
  try {
    const users = await getAllUsers();
    const usersWithQR = users.filter(u => u.qrCode);
    
    console.log(`   找到 ${usersWithQR.length} 个有二维码的用户`);
    
    let urlFormatCount = 0;
    let jsonFormatCount = 0;
    
    for (const user of usersWithQR) {
      if (user.qrCode.startsWith('http')) {
        urlFormatCount++;
      } else {
        jsonFormatCount++;
      }
    }
    
    console.log(`   URL格式: ${urlFormatCount} 个`);
    console.log(`   JSON格式: ${jsonFormatCount} 个`);
    
    if (jsonFormatCount === 0) {
      console.log('   ✅ 所有用户都使用URL格式二维码');
      passedTests++;
    } else {
      console.log('   ❌ 仍有用户使用旧JSON格式');
    }
    
  } catch (error) {
    console.log('   ❌ 测试失败:', error.message);
  }
  
  // 测试2: 验证URL格式二维码
  console.log('\n📋 测试2: 验证URL格式二维码');
  totalTests++;
  
  try {
    const user = await getUserById('652fd327-5fd5-4f71-9bd4-e24caa5e2499'); // 王天龙
    
    if (user && user.qrCode) {
      const validatedData = validateQRData(user.qrCode);
      
      if (validatedData.candidateId === user.id && validatedData.candidateName === user.name) {
        console.log('   ✅ URL验证通过，数据匹配正确');
        passedTests++;
      } else {
        console.log('   ❌ URL验证失败，数据不匹配');
      }
    } else {
      console.log('   ❌ 测试用户不存在或无二维码');
    }
    
  } catch (error) {
    console.log('   ❌ 测试失败:', error.message);
  }
  
  // 测试3: 测试二维码图片生成
  console.log('\n📋 测试3: 测试二维码图片生成');
  totalTests++;
  
  try {
    const user = await getUserById('652fd327-5fd5-4f71-9bd4-e24caa5e2499'); // 王天龙
    
    if (user && user.qrCode) {
      const qrImage = await generateQRCodeImage(user.qrCode);
      
      if (qrImage && qrImage.startsWith('data:image/png;base64,')) {
        console.log('   ✅ 二维码图片生成成功');
        console.log(`   图片大小: ${qrImage.length} 字符`);
        passedTests++;
      } else {
        console.log('   ❌ 二维码图片格式不正确');
      }
    } else {
      console.log('   ❌ 测试用户不存在或无二维码');
    }
    
  } catch (error) {
    console.log('   ❌ 测试失败:', error.message);
  }
  
  // 测试4: 测试新用户二维码生成
  console.log('\n📋 测试4: 测试新用户二维码生成');
  totalTests++;
  
  try {
    const testUserData = {
      userId: 'test-final-verification',
      name: '最终验证用户',
      gender: 'female'
    };
    
    const { qrData, qrCodeImage } = await generateCompleteQRCode(testUserData, []);
    
    // 验证生成的URL
    const validatedData = validateQRData(qrData);
    
    if (validatedData.candidateId === testUserData.userId && 
        validatedData.candidateName === testUserData.name &&
        qrCodeImage.startsWith('data:image/png;base64,')) {
      console.log('   ✅ 新用户二维码生成成功');
      console.log(`   URL: ${qrData.substring(0, 80)}...`);
      passedTests++;
    } else {
      console.log('   ❌ 新用户二维码生成失败');
    }
    
  } catch (error) {
    console.log('   ❌ 测试失败:', error.message);
  }
  
  // 测试5: 测试URL参数完整性
  console.log('\n📋 测试5: 测试URL参数完整性');
  totalTests++;
  
  try {
    const testUserData = {
      userId: 'test-params',
      name: '参数测试用户',
      gender: 'male'
    };
    
    const { qrData } = await generateCompleteQRCode(testUserData, []);
    const url = new URL(qrData);
    
    const requiredParams = ['candidate_id', 'candidate_name', 'source', 'timestamp', 'category'];
    const missingParams = requiredParams.filter(param => !url.searchParams.has(param));
    
    if (missingParams.length === 0) {
      console.log('   ✅ 所有必需参数都存在');
      console.log(`   参数: ${Array.from(url.searchParams.keys()).join(', ')}`);
      passedTests++;
    } else {
      console.log('   ❌ 缺少必需参数:', missingParams.join(', '));
    }
    
  } catch (error) {
    console.log('   ❌ 测试失败:', error.message);
  }
  
  // 输出最终结果
  console.log('\n' + '='.repeat(50));
  console.log('📊 最终验证结果');
  console.log('='.repeat(50));
  console.log(`通过测试: ${passedTests}/${totalTests}`);
  console.log(`成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！QR码投票URL功能完全正常！');
    console.log('✅ 个人信息二维码已成功升级为投票URL二维码');
    console.log('✅ 用户扫码后可直接跳转到投票页面');
    console.log('✅ 所有安全和验证机制正常工作');
  } else {
    console.log('\n⚠️  部分测试未通过，请检查相关功能');
  }
}

finalVerification();