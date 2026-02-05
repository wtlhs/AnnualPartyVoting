const DataExportManager = require('../database/DataExportManager');

/**
 * 导出文件清理服务
 * 定时清理过期的导出文件和任务记录
 */
class ExportCleanupService {
  constructor() {
    this.dataExportManager = new DataExportManager();
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  /**
   * 启动定时清理服务
   * @param {number} intervalHours - 清理间隔（小时）
   * @param {number} maxFileAgeHours - 文件最大保存时间（小时）
   */
  start(intervalHours = 6, maxFileAgeHours = 24) {
    if (this.isRunning) {
      console.log('导出文件清理服务已在运行中');
      return;
    }

    console.log(`启动导出文件清理服务，清理间隔: ${intervalHours}小时，文件保存时间: ${maxFileAgeHours}小时`);

    // 延迟首次清理，避免启动时与投票操作争夺数据库连接
    // 等待5分钟后才开始第一次清理，给系统时间稳定
    setTimeout(() => {
      this.performCleanup(maxFileAgeHours);

      // 首次清理完成后，设置定时清理
      this.cleanupInterval = setInterval(() => {
        this.performCleanup(maxFileAgeHours);
      }, intervalHours * 60 * 60 * 1000); // 转换为毫秒
    }, 5 * 60 * 1000); // 5分钟延迟

    this.isRunning = true;
  }

  /**
   * 停止定时清理服务
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('导出文件清理服务已停止');
  }

  /**
   * 执行清理操作
   * @param {number} maxFileAgeHours - 文件最大保存时间（小时）
   */
  async performCleanup(maxFileAgeHours = 24) {
    try {
      console.log(`开始清理过期导出文件，文件保存时间: ${maxFileAgeHours}小时`);
      
      // 清理过期文件
      const fileCleanupResult = await this.dataExportManager.cleanupExpiredFiles(maxFileAgeHours);
      
      // 清理过期任务记录
      const taskCleanupResult = await this.dataExportManager.cleanupExpiredTasks();
      
      console.log('导出文件清理完成:', {
        files: {
          deletedCount: fileCleanupResult.deletedCount,
          totalSizeFreed: this.formatFileSize(fileCleanupResult.totalSizeFreed)
        },
        tasks: {
          deletedCount: taskCleanupResult.deletedCount
        },
        cleanupTime: fileCleanupResult.cleanupTime
      });
      
      return {
        success: true,
        fileCleanup: fileCleanupResult,
        taskCleanup: taskCleanupResult
      };
      
    } catch (error) {
      console.error('导出文件清理失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 手动触发清理
   * @param {number} maxFileAgeHours - 文件最大保存时间（小时）
   * @returns {Promise<Object>} 清理结果
   */
  async manualCleanup(maxFileAgeHours = 24) {
    console.log('手动触发导出文件清理');
    return await this.performCleanup(maxFileAgeHours);
  }

  /**
   * 获取清理服务状态
   * @returns {Object} 服务状态信息
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.cleanupInterval !== null,
      nextCleanupTime: this.cleanupInterval ? 
        new Date(Date.now() + this.cleanupInterval._idleTimeout).toISOString() : null
    };
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取导出目录统计信息
   * @returns {Promise<Object>} 目录统计信息
   */
  async getExportDirectoryStats() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const exportDir = path.join(process.cwd(), 'exports');
      
      try {
        const files = await fs.readdir(exportDir);
        let totalSize = 0;
        let fileCount = 0;
        const fileDetails = [];
        
        for (const file of files) {
          const filePath = path.join(exportDir, file);
          try {
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
              totalSize += stats.size;
              fileCount++;
              fileDetails.push({
                filename: file,
                size: stats.size,
                sizeFormatted: this.formatFileSize(stats.size),
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime
              });
            }
          } catch (fileError) {
            console.warn(`获取文件 ${file} 统计信息失败:`, fileError.message);
          }
        }
        
        return {
          success: true,
          directory: exportDir,
          fileCount,
          totalSize,
          totalSizeFormatted: this.formatFileSize(totalSize),
          files: fileDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        };
        
      } catch (dirError) {
        if (dirError.code === 'ENOENT') {
          return {
            success: true,
            directory: exportDir,
            fileCount: 0,
            totalSize: 0,
            totalSizeFormatted: '0 B',
            files: [],
            message: '导出目录不存在'
          };
        }
        throw dirError;
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 创建全局实例
const exportCleanupService = new ExportCleanupService();

module.exports = {
  ExportCleanupService,
  exportCleanupService
};