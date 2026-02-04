#!/usr/bin/env node

/**
 * Final verification script for QR code migration to original vote confirmation page format
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { validateQRData, extractUserIdFromQR } = require('./src/utils/qrcode');

// Database path
const dbPath = path.join(__dirname, 'data', 'voting.db');

/**
 * Get all users with QR codes from database
 */
function getAllUsersFromDB() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.all(`
      SELECT id, name, gender, qr_code 
      FROM users 
      WHERE qr_code IS NOT NULL AND qr_code != ''
      ORDER BY name
    `, (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Verify QR code format and functionality
 */
function verifyQRCode(user) {
  const result = {
    userId: user.id,
    name: user.name,
    qrCode: user.qr_code,
    isValid: false,
    format: 'unknown',
    extractedUserId: null,
    issues: []
  };
  
  try {
    // Check if QR code is a URL
    if (!user.qr_code.startsWith('http')) {
      result.issues.push('QR码不是URL格式');
      return result;
    }
    
    // Check if it's the correct format
    const url = new URL(user.qr_code);
    if (url.pathname.startsWith('/vote/')) {
      result.format = 'original';
      const pathParts = url.pathname.split('/');
      if (pathParts.length === 3 && pathParts[2]) {
        result.extractedUserId = pathParts[2];
        
        // Verify extracted user ID matches database user ID
        if (result.extractedUserId === user.id) {
          result.isValid = true;
        } else {
          result.issues.push(`用户ID不匹配: 数据库=${user.id}, QR码=${result.extractedUserId}`);
        }
      } else {
        result.issues.push('URL路径格式无效');
      }
    } else if (url.pathname === '/vote' && url.search) {
      result.format = 'new_params';
      result.issues.push('仍然是新参数格式，需要迁移');
    } else {
      result.issues.push('未知的URL格式');
    }
    
    // Try to validate using the validation function
    try {
      const validatedData = validateQRData(user.qr_code);
      if (validatedData.format === 'original') {
        result.format = 'original';
        result.extractedUserId = validatedData.candidateId;
      }
    } catch (validationError) {
      result.issues.push(`验证函数错误: ${validationError.message}`);
    }
    
  } catch (error) {
    result.issues.push(`处理错误: ${error.message}`);
  }
  
  return result;
}

/**
 * Main verification function
 */
async function verifyQRCodeMigration() {
  console.log('🔍 验证QR码迁移结果...\n');
  
  try {
    // Get all users from database
    const users = await getAllUsersFromDB();
    console.log(`📊 数据库中共有 ${users.length} 个用户有QR码\n`);
    
    let validCount = 0;
    let invalidCount = 0;
    let originalFormatCount = 0;
    let newFormatCount = 0;
    
    console.log('📋 验证结果详情:');
    console.log(''.padEnd(80, '='));
    
    for (const user of users) {
      const verification = verifyQRCode(user);
      
      console.log(`👤 ${user.name} (${user.id})`);
      console.log(`   QR码: ${user.qr_code}`);
      console.log(`   格式: ${verification.format}`);
      console.log(`   有效: ${verification.isValid ? '✅ 是' : '❌ 否'}`);
      
      if (verification.extractedUserId) {
        console.log(`   提取的用户ID: ${verification.extractedUserId}`);
      }
      
      if (verification.issues.length > 0) {
        console.log(`   问题: ${verification.issues.join(', ')}`);
      }
      
      // Update counters
      if (verification.isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
      
      if (verification.format === 'original') {
        originalFormatCount++;
      } else if (verification.format === 'new_params') {
        newFormatCount++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log(''.padEnd(80, '='));
    console.log('📊 验证统计结果:');
    console.log(`   ✅ 有效QR码: ${validCount} 个`);
    console.log(`   ❌ 无效QR码: ${invalidCount} 个`);
    console.log(`   📱 原有格式: ${originalFormatCount} 个`);
    console.log(`   🆕 新参数格式: ${newFormatCount} 个`);
    console.log(`   📊 总计: ${users.length} 个`);
    
    // Final assessment
    console.log('\n🎯 迁移评估:');
    if (validCount === users.length && originalFormatCount === users.length) {
      console.log('🎉 迁移完全成功！所有QR码都已正确迁移到原有投票确认页面格式。');
      console.log('📱 用户扫描QR码将直接跳转到: http://192.168.0.97:3000/vote/:userId');
      console.log('✅ 可以正常使用原有的投票确认页面功能。');
    } else if (originalFormatCount > 0) {
      console.log(`⚠️  部分迁移成功。${originalFormatCount} 个QR码已迁移，${users.length - originalFormatCount} 个仍需处理。`);
    } else {
      console.log('❌ 迁移未成功。建议重新运行迁移脚本。');
    }
    
    // Test URL examples
    if (originalFormatCount > 0) {
      console.log('\n🔗 示例QR码URL:');
      const exampleUser = users.find(u => verifyQRCode(u).format === 'original');
      if (exampleUser) {
        console.log(`   ${exampleUser.qr_code}`);
        console.log('   ↳ 扫描此QR码将跳转到投票确认页面');
      }
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    process.exit(1);
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifyQRCodeMigration().catch(error => {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  });
}

module.exports = { verifyQRCodeMigration };