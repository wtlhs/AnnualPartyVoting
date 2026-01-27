const fs = require('fs');
const path = require('path');

/**
 * File management utilities for data cleanup and backup
 */

/**
 * Clean up avatar files from uploads directory
 * @param {Array} userAvatarUrls - Array of avatar URLs to preserve (optional)
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanupAvatarFiles(userAvatarUrls = []) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Check if uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      return resolve({
        success: true,
        message: '上传目录不存在，无需清理',
        filesRemoved: 0
      });
    }
    
    try {
      // Get all files in uploads directory
      const files = fs.readdirSync(uploadsDir);
      
      // Extract filenames from avatar URLs to preserve
      const preserveFiles = userAvatarUrls
        .filter(url => url && url.startsWith('/uploads/'))
        .map(url => path.basename(url));
      
      let filesRemoved = 0;
      const errors = [];
      
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        
        // Skip if file should be preserved
        if (preserveFiles.includes(file)) {
          return;
        }
        
        // Skip if it's not a file (e.g., subdirectory)
        if (!fs.statSync(filePath).isFile()) {
          return;
        }
        
        // Skip if it's not an image file
        const ext = path.extname(file).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
          return;
        }
        
        try {
          fs.unlinkSync(filePath);
          filesRemoved++;
        } catch (error) {
          errors.push(`删除文件 ${file} 失败: ${error.message}`);
        }
      });
      
      resolve({
        success: true,
        message: `成功清理 ${filesRemoved} 个头像文件`,
        filesRemoved,
        errors: errors.length > 0 ? errors : null
      });
      
    } catch (error) {
      reject(new Error(`清理头像文件失败: ${error.message}`));
    }
  });
}

/**
 * Create backup of avatar files
 * @param {Array} userAvatarUrls - Array of avatar URLs to backup
 * @returns {Promise<Object>} Backup result
 */
async function backupAvatarFiles(userAvatarUrls = []) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const backupDir = path.join(process.cwd(), 'backups', `avatars-${Date.now()}`);
    
    // Check if uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      return resolve({
        success: true,
        message: '上传目录不存在，无需备份',
        filesBackedUp: 0,
        backupPath: null
      });
    }
    
    try {
      // Create backup directory
      fs.mkdirSync(backupDir, { recursive: true });
      
      // Extract filenames from avatar URLs
      const avatarFiles = userAvatarUrls
        .filter(url => url && url.startsWith('/uploads/'))
        .map(url => path.basename(url));
      
      let filesBackedUp = 0;
      const errors = [];
      
      avatarFiles.forEach(file => {
        const sourcePath = path.join(uploadsDir, file);
        const destPath = path.join(backupDir, file);
        
        // Check if source file exists
        if (!fs.existsSync(sourcePath)) {
          errors.push(`源文件不存在: ${file}`);
          return;
        }
        
        try {
          fs.copyFileSync(sourcePath, destPath);
          filesBackedUp++;
        } catch (error) {
          errors.push(`备份文件 ${file} 失败: ${error.message}`);
        }
      });
      
      resolve({
        success: true,
        message: `成功备份 ${filesBackedUp} 个头像文件`,
        filesBackedUp,
        backupPath: backupDir,
        errors: errors.length > 0 ? errors : null
      });
      
    } catch (error) {
      reject(new Error(`备份头像文件失败: ${error.message}`));
    }
  });
}

/**
 * Get uploads directory information
 * @returns {Promise<Object>} Directory information
 */
async function getUploadsInfo() {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    try {
      if (!fs.existsSync(uploadsDir)) {
        return resolve({
          exists: false,
          path: uploadsDir,
          totalFiles: 0,
          totalSize: 0,
          totalSizeFormatted: '0 Bytes'
        });
      }
      
      const files = fs.readdirSync(uploadsDir);
      let totalSize = 0;
      let imageFiles = 0;
      
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            totalSize += stats.size;
            imageFiles++;
          }
        }
      });
      
      resolve({
        exists: true,
        path: uploadsDir,
        totalFiles: imageFiles,
        totalSize,
        totalSizeFormatted: formatFileSize(totalSize)
      });
      
    } catch (error) {
      reject(new Error(`获取上传目录信息失败: ${error.message}`));
    }
  });
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  cleanupAvatarFiles,
  backupAvatarFiles,
  getUploadsInfo,
  formatFileSize
};