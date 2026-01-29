const { getDatabase } = require('./init');

/**
 * VoteRecordManager - 管理投票记录的查询、筛选和状态管理
 * 支持分页、搜索和多条件筛选功能
 */
class VoteRecordManager {
  
  /**
   * 获取投票记录列表（支持筛选和分页）
   * @param {Object} filters - 筛选条件
   * @param {string} [filters.status] - 投票状态 ('active' 或 'inactive')
   * @param {string} [filters.voter] - 投票者姓名（模糊搜索）
   * @param {string} [filters.candidate] - 被投票者姓名（模糊搜索）
   * @param {string} [filters.dateFrom] - 开始日期
   * @param {string} [filters.dateTo] - 结束日期
   * @param {string} [filters.voteMethod] - 投票方式
   * @param {Object} pagination - 分页参数
   * @param {number} [pagination.page=1] - 页码
   * @param {number} [pagination.limit=20] - 每页记录数
   * @param {string} [pagination.sortBy='created_at'] - 排序字段
   * @param {string} [pagination.sortOrder='DESC'] - 排序方向
   * @returns {Promise<Object>} 包含记录列表和分页信息的对象
   */
  async getVoteRecords(filters = {}, pagination = {}) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      const {
        status,
        voter,
        candidate,
        dateFrom,
        dateTo,
        voteMethod
      } = filters;
      
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = pagination;
      
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
      
      // 验证排序字段
      const allowedSortFields = ['created_at', 'updated_at', 'vote_time', 'status'];
      const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? 
        sortOrder.toUpperCase() : 'DESC';
      
      // 计算偏移量
      const offset = (page - 1) * limit;
      
      // 主查询SQL
      const mainSql = `
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
          target_user.gender as target_gender,
          target_user.avatar_url as target_avatar_url
        FROM votes v
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
        ${whereClause}
        ORDER BY v.${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      // 计数查询SQL
      const countSql = `
        SELECT COUNT(*) as total
        FROM votes v
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
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
          
          const records = rows.map(row => ({
            id: row.id,
            voterId: row.voter_id,
            voterName: row.voter_name,
            voterNumericId: row.voter_numeric_id,
            voterGender: row.voter_gender,
            targetUserId: row.target_user_id,
            targetName: row.target_name,
            targetNumericId: row.target_numeric_id,
            targetGender: row.target_gender,
            targetAvatarUrl: row.target_avatar_url,
            status: row.status,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            voteMethod: row.vote_method,
            voteTime: row.vote_time,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          
          resolve({
            records,
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
   * 获取单个投票记录详情
   * @param {number} voteId - 投票记录ID
   * @returns {Promise<Object|null>} 投票记录详情对象或null
   */
  async getVoteRecordDetail(voteId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
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
          voter_user.avatar_url as voter_avatar_url,
          target_user.name as target_name,
          target_user.numeric_id as target_numeric_id,
          target_user.gender as target_gender,
          target_user.avatar_url as target_avatar_url
        FROM votes v
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
        WHERE v.id = ?
      `;
      
      db.get(sql, [voteId], (err, row) => {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        if (!row) {
          return resolve(null);
        }
        
        resolve({
          id: row.id,
          voterId: row.voter_id,
          voterName: row.voter_name,
          voterNumericId: row.voter_numeric_id,
          voterGender: row.voter_gender,
          voterAvatarUrl: row.voter_avatar_url,
          targetUserId: row.target_user_id,
          targetName: row.target_name,
          targetNumericId: row.target_numeric_id,
          targetGender: row.target_gender,
          targetAvatarUrl: row.target_avatar_url,
          status: row.status,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          voteMethod: row.vote_method,
          voteTime: row.vote_time,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      });
    });
  }
  
  /**
   * 更新投票记录状态
   * @param {number} voteId - 投票记录ID
   * @param {string} status - 新状态 ('active' 或 'inactive')
   * @param {string} adminId - 管理员ID
   * @param {string} [reason] - 操作原因
   * @returns {Promise<Object>} 更新结果
   */
  async updateVoteStatus(voteId, status, adminId, reason = null) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      // 验证状态值
      if (!['active', 'inactive'].includes(status)) {
        db.close();
        return reject(new Error('状态值必须是 active 或 inactive'));
      }
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          // 检查投票记录是否存在
          db.get('SELECT * FROM votes WHERE id = ?', [voteId], (err, vote) => {
            if (err) {
              db.run('ROLLBACK');
              db.close();
              return reject(err);
            }
            
            if (!vote) {
              db.run('ROLLBACK');
              db.close();
              return reject(new Error('投票记录不存在'));
            }
            
            // 检查状态是否需要更新
            if (vote.status === status) {
              db.run('ROLLBACK');
              db.close();
              return resolve({
                success: true,
                message: '状态未发生变化',
                voteId,
                oldStatus: vote.status,
                newStatus: status
              });
            }
            
            // 更新投票记录状态
            const updateSql = `
              UPDATE votes 
              SET status = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `;
            
            db.run(updateSql, [status, voteId], function(err) {
              if (err) {
                db.run('ROLLBACK');
                db.close();
                return reject(err);
              }
              
              // 记录操作日志
              const operation = status === 'active' ? 'activate' : 'deactivate';
              const logSql = `
                INSERT INTO audit_logs (vote_id, admin_id, operation, reason, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              `;
              
              db.run(logSql, [voteId, adminId, operation, reason], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  db.close();
                  return reject(err);
                }
                
                db.run('COMMIT', (err) => {
                  db.close();
                  if (err) {
                    return reject(err);
                  }
                  
                  resolve({
                    success: true,
                    message: `投票记录状态已更新为 ${status}`,
                    voteId,
                    oldStatus: vote.status,
                    newStatus: status,
                    adminId,
                    reason,
                    updatedAt: new Date().toISOString()
                  });
                });
              });
            });
          });
        });
      });
    });
  }
  
  /**
   * 批量更新投票记录状态
   * @param {number[]} voteIds - 投票记录ID数组
   * @param {string} status - 新状态 ('active' 或 'inactive')
   * @param {string} adminId - 管理员ID
   * @param {string} [reason] - 操作原因
   * @returns {Promise<Object>} 批量更新结果
   */
  async batchUpdateVoteStatus(voteIds, status, adminId, reason = null) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      // 验证输入
      if (!Array.isArray(voteIds) || voteIds.length === 0) {
        db.close();
        return reject(new Error('投票记录ID数组不能为空'));
      }
      
      if (!['active', 'inactive'].includes(status)) {
        db.close();
        return reject(new Error('状态值必须是 active 或 inactive'));
      }
      
      const results = {
        success: true,
        totalRequested: voteIds.length,
        updated: 0,
        skipped: 0,
        failed: 0,
        details: [],
        errors: []
      };
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          const operation = status === 'active' ? 'activate' : 'deactivate';
          
          // 处理每个投票记录 - 使用串行处理避免并发问题
          const processVote = (index) => {
            if (index >= voteIds.length) {
              // 所有记录处理完成
              if (results.failed > 0 && results.updated === 0) {
                // 全部失败，回滚事务
                db.run('ROLLBACK', (rollbackErr) => {
                  db.close();
                  if (rollbackErr) {
                    return reject(rollbackErr);
                  }
                  results.success = false;
                  resolve(results);
                });
              } else {
                // 提交事务
                db.run('COMMIT', (commitErr) => {
                  db.close();
                  if (commitErr) {
                    return reject(commitErr);
                  }
                  resolve(results);
                });
              }
              return;
            }
            
            const voteId = voteIds[index];
            
            // 检查投票记录是否存在
            db.get('SELECT * FROM votes WHERE id = ?', [voteId], (err, vote) => {
              if (err) {
                results.failed++;
                results.errors.push({ voteId, error: err.message });
                processVote(index + 1);
              } else if (!vote) {
                results.failed++;
                results.errors.push({ voteId, error: '投票记录不存在' });
                processVote(index + 1);
              } else if (vote.status === status) {
                results.skipped++;
                results.details.push({ voteId, action: 'skipped', reason: '状态未发生变化' });
                processVote(index + 1);
              } else {
                // 更新状态
                const updateSql = `
                  UPDATE votes 
                  SET status = ?, updated_at = CURRENT_TIMESTAMP 
                  WHERE id = ?
                `;
                
                db.run(updateSql, [status, voteId], function(updateErr) {
                  if (updateErr) {
                    results.failed++;
                    results.errors.push({ voteId, error: updateErr.message });
                    processVote(index + 1);
                  } else {
                    // 记录操作日志
                    const logSql = `
                      INSERT INTO audit_logs (vote_id, admin_id, operation, reason, created_at)
                      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `;
                    
                    db.run(logSql, [voteId, adminId, operation, reason], (logErr) => {
                      if (logErr) {
                        results.failed++;
                        results.errors.push({ voteId, error: `状态更新成功但日志记录失败: ${logErr.message}` });
                      } else {
                        results.updated++;
                        results.details.push({ 
                          voteId, 
                          action: 'updated', 
                          oldStatus: vote.status, 
                          newStatus: status 
                        });
                      }
                      processVote(index + 1);
                    });
                  }
                });
              }
            });
          };
          
          // 开始处理第一个投票记录
          processVote(0);
        });
      });
    });
  }
  
  /**
   * 搜索投票记录
   * @param {string} searchTerm - 搜索词
   * @param {Object} [filters] - 额外筛选条件
   * @param {Object} [pagination] - 分页参数
   * @returns {Promise<Object>} 搜索结果
   */
  async searchVoteRecords(searchTerm, filters = {}, pagination = {}) {
    if (!searchTerm || !searchTerm.trim()) {
      return this.getVoteRecords(filters, pagination);
    }
    
    // 将搜索词添加到筛选条件中
    const searchFilters = {
      ...filters,
      voter: searchTerm,
      candidate: searchTerm
    };
    
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      const {
        status,
        dateFrom,
        dateTo,
        voteMethod
      } = filters;
      
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = pagination;
      
      // 构建WHERE条件 - 搜索投票者或被投票者
      const whereConditions = [
        '(voter_user.name LIKE ? OR voter_user.numeric_id LIKE ? OR target_user.name LIKE ? OR target_user.numeric_id LIKE ?)'
      ];
      const params = [
        `%${searchTerm}%`, 
        `%${searchTerm}%`, 
        `%${searchTerm}%`, 
        `%${searchTerm}%`
      ];
      
      // 添加其他筛选条件
      if (status) {
        whereConditions.push('v.status = ?');
        params.push(status);
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
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      // 验证排序字段
      const allowedSortFields = ['created_at', 'updated_at', 'vote_time', 'status'];
      const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? 
        sortOrder.toUpperCase() : 'DESC';
      
      // 计算偏移量
      const offset = (page - 1) * limit;
      
      // 主查询SQL
      const mainSql = `
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
          target_user.gender as target_gender,
          target_user.avatar_url as target_avatar_url
        FROM votes v
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
        ${whereClause}
        ORDER BY v.${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      // 计数查询SQL
      const countSql = `
        SELECT COUNT(*) as total
        FROM votes v
        LEFT JOIN users voter_user ON v.voter_id = voter_user.id
        LEFT JOIN users target_user ON v.target_user_id = target_user.id
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
          
          const records = rows.map(row => ({
            id: row.id,
            voterId: row.voter_id,
            voterName: row.voter_name,
            voterNumericId: row.voter_numeric_id,
            voterGender: row.voter_gender,
            targetUserId: row.target_user_id,
            targetName: row.target_name,
            targetNumericId: row.target_numeric_id,
            targetGender: row.target_gender,
            targetAvatarUrl: row.target_avatar_url,
            status: row.status,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            voteMethod: row.vote_method,
            voteTime: row.vote_time,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          
          resolve({
            records,
            searchTerm,
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
}

module.exports = VoteRecordManager;