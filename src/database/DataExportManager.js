const { getDatabase, releaseConnection } = require('./init');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

/**
 * DataExportManager - 处理投票记录数据的导出功能
 * 支持CSV和Excel格式导出，按筛选条件导出数据
 */
class DataExportManager {
  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDirectory();
  }

  /**
   * 确保导出目录存在
   */
  async ensureExportDirectory() {
    try {
      await fs.access(this.exportDir);
    } catch (error) {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }

  /**
   * 获取导出数据（基于筛选条件）
   * @param {Object} filters - 筛选条件
   * @returns {Promise<Array>} 导出数据数组
   */
  async getExportData(filters = {}) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();
      
      const {
        status,
        voter,
        candidate,
        dateFrom,
        dateTo,
        voteMethod
      } = filters;
      
      // 构建WHERE条件
      const whereConditions = [];
      const params = [];
      
      if (status) {
        whereConditions.push('v.status = ?');
        params.push(status);
      }
      
      if (voter) {
        whereConditions.push('(voter_user.name LIKE ? OR voter_user.numeric_id LIKE ?)');
        params.push(`%${voter}%`, `%${voter}%`);
      }
      
      if (candidate) {
        whereConditions.push('(target_user.name LIKE ? OR target_user.numeric_id LIKE ?)');
        params.push(`%${candidate}%`, `%${candidate}%`);
      }
      
      if (dateFrom) {
        whereConditions.push('DATE(v.created_at) >= DATE(?)');
        params.push(dateFrom);
      }
      
      if (dateTo) {
        whereConditions.push('DATE(v.created_at) <= DATE(?)');
        params.push(dateTo);
      }
      
      if (voteMethod) {
        whereConditions.push('v.vote_method = ?');
        params.push(voteMethod);
      }
      
      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const sql = `
        SELECT 
          v.id,
          v.voter_id,
          v.target_user_id,
          v.status,
          v.ip_address,
          v.user_agent,
          v.vote_method,
          v.vote_time,
          v.created_at,
          v.updated_at,
          voter_user.name as voter_name,
          voter_user.numeric_id as voter_numeric_id,
          voter_user.gender as voter_gender,
          target_user.name as target_name,
          target_user.numeric_id as target_numeric_id,
          target_user.gender as target_gender
        FROM votes v
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
        ${whereClause}
        ORDER BY v.created_at DESC
      `;
      
      db.all(sql, params, (err, rows) => {
        releaseConnection(db);
        
        if (err) {
          return reject(err);
        }
        
        const exportData = rows.map(row => ({
          投票记录ID: row.id,
          投票者ID: row.voter_id,
          投票者姓名: row.voter_name || '',
          投票者工号: row.voter_numeric_id || '',
          投票者性别: row.voter_gender || '',
          被投票者ID: row.target_user_id,
          被投票者姓名: row.target_name || '',
          被投票者工号: row.target_numeric_id || '',
          被投票者性别: row.target_gender || '',
          投票状态: row.status === 'active' ? '有效' : '无效',
          IP地址: row.ip_address || '',
          用户代理: row.user_agent || '',
          投票方式: row.vote_method === 'qr_code' ? '二维码扫描' : '姓名搜索',
          投票时间: row.vote_time ? moment(row.vote_time).format('YYYY-MM-DD HH:mm:ss') : '',
          创建时间: row.created_at ? moment(row.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
          更新时间: row.updated_at ? moment(row.updated_at).format('YYYY-MM-DD HH:mm:ss') : ''
        }));
        
        resolve(exportData);
      });
    });
  }

  /**
   * 导出CSV格式数据
   * @param {Object} filters - 筛选条件
   * @param {Array} [columns] - 要导出的列（可选）
   * @returns {Promise<Object>} 导出结果
   */
  async exportToCSV(filters = {}, columns = null) {
    try {
      await this.ensureExportDirectory();
      
      const data = await this.getExportData(filters);
      
      if (data.length === 0) {
        throw new Error('没有符合条件的数据可导出');
      }
      
      // 如果指定了列，则只导出指定的列
      let exportData = data;
      let csvColumns = Object.keys(data[0]).map(key => ({
        id: key,
        title: key
      }));
      
      if (columns && Array.isArray(columns) && columns.length > 0) {
        csvColumns = columns.map(col => ({
          id: col,
          title: col
        }));
        exportData = data.map(row => {
          const filteredRow = {};
          columns.forEach(col => {
            if (row.hasOwnProperty(col)) {
              filteredRow[col] = row[col];
            }
          });
          return filteredRow;
        });
      }
      
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `vote_records_${timestamp}.csv`;
      const filePath = path.join(this.exportDir, filename);
      
      const csvWriter = createCsvWriter({
        path: filePath,
        header: csvColumns,
        encoding: 'utf8'
      });
      
      await csvWriter.writeRecords(exportData);
      
      return {
        success: true,
        filePath,
        filename,
        recordCount: exportData.length,
        fileSize: (await fs.stat(filePath)).size,
        createdAt: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`CSV导出失败: ${error.message}`);
    }
  }

  /**
   * 导出Excel格式数据
   * @param {Object} filters - 筛选条件
   * @param {Array} [columns] - 要导出的列（可选）
   * @returns {Promise<Object>} 导出结果
   */
  async exportToExcel(filters = {}, columns = null) {
    try {
      await this.ensureExportDirectory();
      
      const data = await this.getExportData(filters);
      
      if (data.length === 0) {
        throw new Error('没有符合条件的数据可导出');
      }
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('投票记录');
      
      // 如果指定了列，则只导出指定的列
      let exportData = data;
      let columnHeaders = Object.keys(data[0]);
      
      if (columns && Array.isArray(columns) && columns.length > 0) {
        columnHeaders = columns;
        exportData = data.map(row => {
          const filteredRow = {};
          columns.forEach(col => {
            if (row.hasOwnProperty(col)) {
              filteredRow[col] = row[col];
            }
          });
          return filteredRow;
        });
      }
      
      // 设置列标题
      worksheet.columns = columnHeaders.map(header => ({
        header: header,
        key: header,
        width: 15
      }));
      
      // 添加数据行
      exportData.forEach(row => {
        worksheet.addRow(row);
      });
      
      // 设置标题行样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // 自动调整列宽
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });
      
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `vote_records_${timestamp}.xlsx`;
      const filePath = path.join(this.exportDir, filename);
      
      await workbook.xlsx.writeFile(filePath);
      
      return {
        success: true,
        filePath,
        filename,
        recordCount: exportData.length,
        fileSize: (await fs.stat(filePath)).size,
        createdAt: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`Excel导出失败: ${error.message}`);
    }
  }

  /**
   * 生成导出文件下载链接
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 下载链接信息
   */
  async generateDownloadLink(filePath) {
    try {
      // 检查文件是否存在
      await fs.access(filePath);
      
      const filename = path.basename(filePath);
      const fileStats = await fs.stat(filePath);
      
      // 生成唯一的下载token
      const downloadToken = uuidv4();
      
      // 设置过期时间（24小时后）
      const expiresAt = moment().add(24, 'hours').toDate();
      
      return {
        downloadToken,
        filename,
        fileSize: fileStats.size,
        createdAt: fileStats.birthtime,
        expiresAt,
        downloadUrl: `/api/admin/export/${downloadToken}/download`
      };
      
    } catch (error) {
      throw new Error(`生成下载链接失败: ${error.message}`);
    }
  }

  /**
   * 清理过期的导出文件
   * @param {number} [maxAgeHours=24] - 文件最大保存时间（小时）
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupExpiredFiles(maxAgeHours = 24) {
    try {
      await this.ensureExportDirectory();
      
      const files = await fs.readdir(this.exportDir);
      const cutoffTime = moment().subtract(maxAgeHours, 'hours').toDate();
      
      let deletedCount = 0;
      let totalSize = 0;
      const deletedFiles = [];
      
      for (const file of files) {
        const filePath = path.join(this.exportDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.birthtime < cutoffTime) {
            await fs.unlink(filePath);
            deletedCount++;
            totalSize += stats.size;
            deletedFiles.push({
              filename: file,
              size: stats.size,
              createdAt: stats.birthtime
            });
          }
        } catch (fileError) {
          // 忽略单个文件的错误，继续处理其他文件
          console.warn(`清理文件 ${file} 时出错:`, fileError.message);
        }
      }
      
      return {
        success: true,
        deletedCount,
        totalSizeFreed: totalSize,
        deletedFiles,
        cleanupTime: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`清理过期文件失败: ${error.message}`);
    }
  }

  /**
   * 创建导出任务记录
   * @param {number} adminId - 管理员ID
   * @param {string} filePath - 文件路径
   * @param {string} fileType - 文件类型 ('csv' 或 'excel')
   * @param {Object} filters - 筛选条件
   * @returns {Promise<Object>} 任务记录
   */
  async createExportTask(adminId, filePath, fileType, filters = {}) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();
      
      const expiresAt = moment().add(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
      
      const sql = `
        INSERT INTO export_tasks (admin_id, file_path, file_type, filters, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
      `;
      
      db.run(sql, [
        adminId,
        filePath,
        fileType,
        JSON.stringify(filters),
        expiresAt
      ], function(err) {
        releaseConnection(db);
        
        if (err) {
          return reject(err);
        }
        
        resolve({
          taskId: this.lastID,
          adminId,
          filePath,
          fileType,
          filters,
          status: 'completed',
          expiresAt,
          createdAt: new Date().toISOString()
        });
      });
    });
  }

  /**
   * 获取导出任务信息
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object|null>} 任务信息
   */
  async getExportTask(taskId) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();
      
      const sql = `
        SELECT 
          id,
          admin_id,
          file_path,
          file_type,
          filters,
          status,
          created_at,
          expires_at
        FROM export_tasks
        WHERE id = ?
      `;
      
      db.get(sql, [taskId], (err, row) => {
        releaseConnection(db);
        
        if (err) {
          return reject(err);
        }
        
        if (!row) {
          return resolve(null);
        }
        
        resolve({
          taskId: row.id,
          adminId: row.admin_id,
          filePath: row.file_path,
          fileType: row.file_type,
          filters: JSON.parse(row.filters || '{}'),
          status: row.status,
          createdAt: row.created_at,
          expiresAt: row.expires_at
        });
      });
    });
  }

  /**
   * 获取导出目录统计信息
   * @returns {Promise<Object>} 目录统计信息
   */
  async getExportDirectoryStats() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      try {
        const files = await fs.readdir(this.exportDir);
        let totalSize = 0;
        let fileCount = 0;
        const fileDetails = [];
        
        for (const file of files) {
          const filePath = path.join(this.exportDir, file);
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
          directory: this.exportDir,
          fileCount,
          totalSize,
          totalSizeFormatted: this.formatFileSize(totalSize),
          files: fileDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        };
        
      } catch (dirError) {
        if (dirError.code === 'ENOENT') {
          return {
            success: true,
            directory: this.exportDir,
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
   * 删除过期的导出任务记录
   * @returns {Promise<Object>} 删除结果
   */
  async cleanupExpiredTasks() {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();
      
      const sql = `
        DELETE FROM export_tasks
        WHERE expires_at < CURRENT_TIMESTAMP
      `;
      
      db.run(sql, [], function(err) {
        releaseConnection(db);
        
        if (err) {
          return reject(err);
        }
        
        resolve({
          success: true,
          deletedCount: this.changes,
          cleanupTime: new Date().toISOString()
        });
      });
    });
  }
}

module.exports = DataExportManager;