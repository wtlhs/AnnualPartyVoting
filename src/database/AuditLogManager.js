const { getDatabase } = require('./init');

/**
 * AuditLogManager - 管理操作日志的记录和查询功能
 * 支持按投票记录和管理员查询操作历史
 */
class AuditLogManager {
  
  /**
   * 记录操作日志
   * @param {number} voteId - 投票记录ID
   * @param {string} adminId - 管理员ID
   * @param {string} operation - 操作类型 ('activate' 或 'deactivate')
   * @param {string} [reason] - 操作原因
   * @param {Object} [metadata] - 额外的元数据信息
   * @returns {Promise<Object>} 创建的日志记录
   */
  async logOperation(voteId, adminId, operation, reason = null, metadata = null) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      // 验证操作类型
      if (!['activate', 'deactivate'].includes(operation)) {
        db.close();
        return reject(new Error('操作类型必须是 activate 或 deactivate'));
      }
      
      // 验证必需参数
      if (!voteId || !adminId) {
        db.close();
        return reject(new Error('投票记录ID和管理员ID是必需的'));
      }
      
      const sql = `
        INSERT INTO audit_logs (vote_id, admin_id, operation, reason, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      const metadataJson = metadata ? JSON.stringify(metadata) : null;
      const params = [voteId, adminId, operation, reason, metadataJson];
      
      db.run(sql, params, function(err) {
        if (err) {
          db.close();
          return reject(err);
        }
        
        const logId = this.lastID;
        
        // 获取刚创建的日志记录详情
        const selectSql = `
          SELECT 
            al.*,
            admin_user.name as admin_name,
            v.target_user_id,
            target_user.name as target_user_name
          FROM audit_logs al
          LEFT JOIN users admin_user ON al.admin_id = admin_user.id
          LEFT JOIN votes v ON al.vote_id = v.id
          LEFT JOIN users target_user ON v.target_user_id = target_user.id
          WHERE al.id = ?
        `;
        
        db.get(selectSql, [logId], (err, row) => {
          db.close();
          
          if (err) {
            return reject(err);
          }
          
          resolve({
            id: row.id,
            voteId: row.vote_id,
            adminId: row.admin_id,
            adminName: row.admin_name,
            operation: row.operation,
            reason: row.reason,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            targetUserId: row.target_user_id,
            targetUserName: row.target_user_name,
            createdAt: row.created_at
          });
        });
      });
    });
  }
  
  /**
   * 获取投票记录的操作历史
   * @param {number} voteId - 投票记录ID
   * @param {Object} [options] - 查询选项
   * @param {number} [options.limit] - 限制返回记录数
   * @param {string} [options.sortOrder='DESC'] - 排序方向
   * @returns {Promise<Array>} 操作历史记录数组
   */
  async getVoteOperationHistory(voteId, options = {}) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      const { limit, sortOrder = 'DESC' } = options;
      
      // 验证排序方向
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? 
        sortOrder.toUpperCase() : 'DESC';
      
      let sql = `
        SELECT 
          al.*,
          admin_user.name as admin_name,
          admin_user.numeric_id as admin_numeric_id,
          v.target_user_id,
          target_user.name as target_user_name,
          v.status as current_vote_status
        FROM audit_logs al
        LEFT JOIN users admin_user ON al.admin_id = admin_user.id
        LEFT JOIN votes v ON al.vote_id = v.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
        WHERE al.vote_id = ?
        ORDER BY al.created_at ${validSortOrder}
      `;
      
      const params = [voteId];
      
      if (limit && limit > 0) {
        sql += ' LIMIT ?';
        params.push(limit);
      }
      
      db.all(sql, params, (err, rows) => {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        const history = rows.map(row => ({
          id: row.id,
          voteId: row.vote_id,
          adminId: row.admin_id,
          adminName: row.admin_name,
          adminNumericId: row.admin_numeric_id,
          operation: row.operation,
          operationText: row.operation === 'activate' ? '恢复投票' : '作废投票',
          reason: row.reason,
          metadata: row.metadata ? JSON.parse(row.metadata) : null,
          targetUserId: row.target_user_id,
          targetUserName: row.target_user_name,
          currentVoteStatus: row.current_vote_status,
          createdAt: row.created_at,
          createdAtFormatted: new Date(row.created_at).toLocaleString('zh-CN')
        }));
        
        resolve(history);
      });
    });
  }
  
  /**
   * 获取管理员操作日志
   * @param {string} adminId - 管理员ID
   * @param {Object} [options] - 查询选项
   * @param {string} [options.dateFrom] - 开始日期
   * @param {string} [options.dateTo] - 结束日期
   * @param {string} [options.operation] - 操作类型筛选
   * @param {number} [options.page=1] - 页码
   * @param {number} [options.limit=20] - 每页记录数
   * @param {string} [options.sortOrder='DESC'] - 排序方向
   * @returns {Promise<Object>} 包含日志记录和分页信息的对象
   */
  async getAdminOperationLogs(adminId, options = {}) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      const {
        dateFrom,
        dateTo,
        operation,
        page = 1,
        limit = 20,
        sortOrder = 'DESC'
      } = options;
      
      // 构建WHERE条件
      const whereConditions = ['al.admin_id = ?'];
      const params = [adminId];
      
      if (dateFrom) {
        whereConditions.push('DATE(al.created_at) >= DATE(?)');
        params.push(dateFrom);
      }
      
      if (dateTo) {
        whereConditions.push('DATE(al.created_at) <= DATE(?)');
        params.push(dateTo);
      }
      
      if (operation && ['activate', 'deactivate'].includes(operation)) {
        whereConditions.push('al.operation = ?');
        params.push(operation);
      }
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      // 验证排序方向
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? 
        sortOrder.toUpperCase() : 'DESC';
      
      // 计算偏移量
      const offset = (page - 1) * limit;
      
      // 主查询SQL
      const mainSql = `
        SELECT 
          al.*,
          admin_user.name as admin_name,
          admin_user.numeric_id as admin_numeric_id,
          v.target_user_id,
          target_user.name as target_user_name,
          target_user.gender as target_user_gender,
          v.status as current_vote_status,
          voter_user.name as voter_name
        FROM audit_logs al
        LEFT JOIN users admin_user ON al.admin_id = admin_user.id
        LEFT JOIN votes v ON al.vote_id = v.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
        ${whereClause}
        ORDER BY al.created_at ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      // 计数查询SQL
      const countSql = `
        SELECT COUNT(*) as total
        FROM audit_logs al
        ${whereClause}
      `;
      
      // 执行计数查询
      db.get(countSql, params, (err, countResult) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);
        
        // 执行主查询
        const mainParams = [...params, limit, offset];
        db.all(mainSql, mainParams, (err, rows) => {
          db.close();
          
          if (err) {
            return reject(err);
          }
          
          const logs = rows.map(row => ({
            id: row.id,
            voteId: row.vote_id,
            adminId: row.admin_id,
            adminName: row.admin_name,
            adminNumericId: row.admin_numeric_id,
            operation: row.operation,
            operationText: row.operation === 'activate' ? '恢复投票' : '作废投票',
            reason: row.reason,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            targetUserId: row.target_user_id,
            targetUserName: row.target_user_name,
            targetUserGender: row.target_user_gender,
            voterName: row.voter_name,
            currentVoteStatus: row.current_vote_status,
            createdAt: row.created_at,
            createdAtFormatted: new Date(row.created_at).toLocaleString('zh-CN')
          }));
          
          resolve({
            logs,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            }
          });
        });
      });
    });
  }
  
  /**
   * 获取操作统计信息
   * @param {Object} [options] - 查询选项
   * @param {string} [options.dateFrom] - 开始日期
   * @param {string} [options.dateTo] - 结束日期
   * @param {string} [options.adminId] - 管理员ID筛选
   * @returns {Promise<Object>} 操作统计信息
   */
  async getOperationStatistics(options = {}) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      const { dateFrom, dateTo, adminId } = options;
      
      // 构建WHERE条件
      const whereConditions = [];
      const params = [];
      
      if (dateFrom) {
        whereConditions.push('DATE(al.created_at) >= DATE(?)');
        params.push(dateFrom);
      }
      
      if (dateTo) {
        whereConditions.push('DATE(al.created_at) <= DATE(?)');
        params.push(dateTo);
      }
      
      if (adminId) {
        whereConditions.push('al.admin_id = ?');
        params.push(adminId);
      }
      
      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const sql = `
        SELECT 
          COUNT(*) as total_operations,
          COUNT(CASE WHEN al.operation = 'activate' THEN 1 END) as activate_operations,
          COUNT(CASE WHEN al.operation = 'deactivate' THEN 1 END) as deactivate_operations,
          COUNT(DISTINCT al.admin_id) as active_admins,
          COUNT(DISTINCT al.vote_id) as affected_votes,
          MIN(al.created_at) as first_operation,
          MAX(al.created_at) as last_operation
        FROM audit_logs al
        ${whereClause}
      `;
      
      db.get(sql, params, (err, row) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        // 获取最活跃的管理员
        const topAdminSql = `
          SELECT 
            al.admin_id,
            u.name as admin_name,
            COUNT(*) as operation_count
          FROM audit_logs al
          LEFT JOIN users u ON al.admin_id = u.id
          ${whereClause}
          GROUP BY al.admin_id, u.name
          ORDER BY operation_count DESC
          LIMIT 5
        `;
        
        db.all(topAdminSql, params, (err, adminRows) => {
          db.close();
          
          if (err) {
            return reject(err);
          }
          
          const topAdmins = adminRows.map(admin => ({
            adminId: admin.admin_id,
            adminName: admin.admin_name,
            operationCount: admin.operation_count
          }));
          
          resolve({
            totalOperations: row.total_operations || 0,
            activateOperations: row.activate_operations || 0,
            deactivateOperations: row.deactivate_operations || 0,
            activeAdmins: row.active_admins || 0,
            affectedVotes: row.affected_votes || 0,
            firstOperation: row.first_operation,
            lastOperation: row.last_operation,
            topAdmins,
            period: {
              dateFrom,
              dateTo,
              adminId
            }
          });
        });
      });
    });
  }
  
  /**
   * 获取最近的操作日志
   * @param {number} [limit=10] - 限制返回记录数
   * @param {string} [adminId] - 可选的管理员ID筛选
   * @returns {Promise<Array>} 最近的操作日志数组
   */
  async getRecentOperations(limit = 10, adminId = null) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      let sql = `
        SELECT 
          al.*,
          admin_user.name as admin_name,
          admin_user.numeric_id as admin_numeric_id,
          v.target_user_id,
          target_user.name as target_user_name,
          target_user.gender as target_user_gender,
          voter_user.name as voter_name
        FROM audit_logs al
        LEFT JOIN users admin_user ON al.admin_id = admin_user.id
        LEFT JOIN votes v ON al.vote_id = v.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
      `;
      
      const params = [];
      
      if (adminId) {
        sql += ' WHERE al.admin_id = ?';
        params.push(adminId);
      }
      
      sql += ' ORDER BY al.created_at DESC LIMIT ?';
      params.push(limit);
      
      db.all(sql, params, (err, rows) => {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        const operations = rows.map(row => ({
          id: row.id,
          voteId: row.vote_id,
          adminId: row.admin_id,
          adminName: row.admin_name,
          adminNumericId: row.admin_numeric_id,
          operation: row.operation,
          operationText: row.operation === 'activate' ? '恢复投票' : '作废投票',
          reason: row.reason,
          metadata: row.metadata ? JSON.parse(row.metadata) : null,
          targetUserId: row.target_user_id,
          targetUserName: row.target_user_name,
          targetUserGender: row.target_user_gender,
          voterName: row.voter_name,
          createdAt: row.created_at,
          createdAtFormatted: new Date(row.created_at).toLocaleString('zh-CN'),
          timeAgo: this._getTimeAgo(row.created_at)
        }));
        
        resolve(operations);
      });
    });
  }
  
  /**
   * 删除过期的操作日志（清理功能）
   * @param {number} [daysToKeep=90] - 保留天数
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupOldLogs(daysToKeep = 90) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      const sql = `
        DELETE FROM audit_logs 
        WHERE created_at < datetime('now', '-${daysToKeep} days')
      `;
      
      db.run(sql, [], function(err) {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        resolve({
          success: true,
          deletedCount: this.changes,
          daysToKeep,
          cleanupDate: new Date().toISOString()
        });
      });
    });
  }
  
  /**
   * 计算时间差的辅助方法
   * @private
   * @param {string} dateString - 日期字符串
   * @returns {string} 时间差描述
   */
  _getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
      return '刚刚';
    } else if (diffMins < 60) {
      return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 30) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  }
}

module.exports = AuditLogManager;