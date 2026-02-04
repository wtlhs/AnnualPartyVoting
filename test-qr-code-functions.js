#!/usr/bin/env node

/**
 * Test script to verify QR code generation and validation functions
 */

const { 
  generateQRData, 
  validateQRData, 
  isQRCodeUnique, 
  extractUserIdFromQR,
  generateCompleteQRCode 
} = require('./src/utils/qrcode');

async function testQRCodeFunctions() {
  console.log('🧪 测试QR码生成和验证功能...\n');
  
  try {
    // Test 1: Generate QR data
    console.log('1️⃣ 测试QR码数据生成');
    const userData = {
      userId: '4e9fa739-0426-450f-a05d-ad7cfedc6bcd',
      name: '扫码测试用户',
      gender: 'female'
    };
    
    const qrData = generateQRData(userData);
    console.log(`✅ 生成的QR码数据: ${qrData}`);
    console.log(`   格式: ${qrData.includes('/vote/') ? '原有投票确认页面格式' : '未知格式'}\n`);
    
    // Test 2: Validate QR data
    console.log('2️⃣ 测试QR码数据验证');
    try {
      const validatedData = validateQRData(qrData);
      console.log('✅ QR码验证成功');
      console.log(`   候选人ID: ${validatedData.candidateId}`);
      console.log(`   格式类型: ${validatedData.format}\n`);
    } catch (error) {
      console.log(`❌ QR码验证失败: ${error.message}\n`);
    }
    
    // Test 3: Extract user ID
    console.log('3️⃣ 测试用户ID提取');
    const extractedUserId = extractUserIdFromQR(qrData);
    console.log(`✅ 提取的用户ID: ${extractedUserId}`);
    console.log(`   匹配原始ID: ${extractedUserId === userData.userId ? '是' : '否'}\n`);
    
    // Test 4: Test uniqueness check
    console.log('4️⃣ 测试唯一性检查');
    const existingQRCodes = [
      'http://192.168.0.97:3000/vote/other-user-id',
      'http://192.168.0.97:3000/vote?candidate_id=another-user&candidate_name=Another&source=qrcode&timestamp=123456',
      '{"userId": "old-format-user", "name": "Old Format"}'
    ];
    
    const isUnique = isQRCodeUnique(qrData, existingQRCodes);
    console.log(`✅ QR码唯一性: ${isUnique ? '唯一' : '重复'}`);
    
    // Test with duplicate
    const duplicateQRCodes = [...existingQRCodes, qrData];
    const isDuplicate = isQRCodeUnique(qrData, duplicateQRCodes);
    console.log(`✅ 重复检查: ${isDuplicate ? '意外通过' : '正确检测到重复'}\n`);
    
    // Test 5: Generate complete QR code
    console.log('5️⃣ 测试完整QR码生成');
    try {
      const completeQR = await generateCompleteQRCode(userData, existingQRCodes);
      console.log('✅ 完整QR码生成成功');
      console.log(`   QR数据: ${completeQR.qrData}`);
      console.log(`   图片数据长度: ${completeQR.qrCodeImage ? completeQR.qrCodeImage.length : 0} 字符\n`);
    } catch (error) {
      console.log(`❌ 完整QR码生成失败: ${error.message}\n`);
    }
    
    // Test 6: Test backward compatibility with old formats
    console.log('6️⃣ 测试向后兼容性');
    
    // Test old JSON format
    const oldJsonQR = '{"userId": "old-user-123", "name": "Old User", "gender": "male"}';
    const oldUserId = extractUserIdFromQR(oldJsonQR);
    console.log(`✅ 旧JSON格式用户ID提取: ${oldUserId}`);
    
    // Test new parameter format (for backward compatibility)
    const newParamQR = 'http://192.168.0.97:3000/vote?candidate_id=new-user-456&candidate_name=New+User&source=qrcode&timestamp=1234567890';
    try {
      const newValidated = validateQRData(newParamQR);
      console.log(`✅ 新参数格式验证成功: ${newValidated.candidateId} (${newValidated.format})`);
    } catch (error) {
      console.log(`❌ 新参数格式验证失败: ${error.message}`);
    }
    
    console.log('\n🎉 所有测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testQRCodeFunctions().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
}

module.exports = { testQRCodeFunctions };