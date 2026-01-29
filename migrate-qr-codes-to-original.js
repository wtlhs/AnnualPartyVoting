#!/usr/bin/env node

/**
 * Migration script to convert QR codes from new format back to original vote confirmation page format
 * This script updates existing user QR codes to use /vote/:userId instead of /vote?params
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { generateQRData, generateQRCodeImage } = require('./src/utils/qrcode');

// Database path
const dbPath = path.join(__dirname, 'data', 'voting.db');

/**
 * Get all users with QR codes
 */
function getAllUsers() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.all(`
      SELECT id, name, gender, qr_code 
      FROM users 
      WHERE qr_code IS NOT NULL AND qr_code != ''
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
 * Update user's QR code data
 */
function updateUserQRCode(userId, newQRData) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.run(`
      UPDATE users 
      SET qr_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newQRData, userId], function(err) {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

/**
 * Check if QR code needs migration (is it in new format?)
 */
function needsMigration(qrData) {
  if (!qrData || !qrData.startsWith('http')) {
    return false; // Old JSON format or empty, skip
  }
  
  try {
    const url = new URL(qrData);
    // If it has query parameters, it's the new format and needs migration
    return url.search.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Extract user ID from new format QR code
 */
function extractUserIdFromNewFormat(qrData) {
  try {
    const url = new URL(qrData);
    return url.searchParams.get('candidate_id');
  } catch (error) {
    return null;
  }
}

/**
 * Main migration function
 */
async function migrateQRCodes() {
  console.log('🔄 开始迁移QR码到原有投票确认页面格式...\n');
  
  try {
    // Get all users
    const users = await getAllUsers();
    console.log(`📊 找到 ${users.length} 个用户记录\n`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        console.log(`处理用户: ${user.name} (${user.id})`);
        
        // Check if this QR code needs migration
        if (!needsMigration(user.qr_code)) {
          console.log(`  ⏭️  跳过 - QR码已经是正确格式或为旧JSON格式`);
          skippedCount++;
          continue;
        }
        
        // Extract user ID from current QR data to verify consistency
        const extractedUserId = extractUserIdFromNewFormat(user.qr_code);
        if (extractedUserId !== user.id) {
          console.log(`  ⚠️  警告 - QR码中的用户ID (${extractedUserId}) 与数据库中的用户ID (${user.id}) 不匹配`);
        }
        
        console.log(`  🔄 当前QR码: ${user.qr_code}`);
        
        // Generate new QR code using original format
        const userData = {
          userId: user.id,
          name: user.name,
          gender: user.gender
        };
        
        const newQRData = generateQRData(userData);
        
        console.log(`  ✅ 新QR码: ${newQRData}`);
        
        // Update in database
        const changes = await updateUserQRCode(user.id, newQRData);
        
        if (changes > 0) {
          console.log(`  💾 数据库更新成功`);
          migratedCount++;
        } else {
          console.log(`  ❌ 数据库更新失败 - 没有行被更新`);
          errorCount++;
        }
        
      } catch (error) {
        console.error(`  ❌ 处理用户 ${user.name} 时出错:`, error.message);
        errorCount++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('📋 迁移完成统计:');
    console.log(`  ✅ 成功迁移: ${migratedCount} 个用户`);
    console.log(`  ⏭️  跳过: ${skippedCount} 个用户`);
    console.log(`  ❌ 错误: ${errorCount} 个用户`);
    console.log(`  📊 总计: ${users.length} 个用户`);
    
    if (migratedCount > 0) {
      console.log('\n🎉 QR码迁移完成！现在所有QR码都指向原有的投票确认页面格式。');
      console.log('📱 用户扫描QR码后将跳转到: http://192.168.0.97:3000/vote/:userId');
    } else {
      console.log('\n📝 没有需要迁移的QR码。');
    }
    
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateQRCodes().catch(error => {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  });
}

module.exports = { migrateQRCodes };