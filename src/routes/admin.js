const express = require('express');
const { 
  getVoteStatistics, 
  getRanking, 
  clearAllData,
  getAllUsers,
  getRecentVotes,
  createDataBackup,
  archiveAndClearData,
  getDatabaseInfo
} = require('../database/operations');

// Import new managers for vote records functionality
const VoteRecordManager = require('../database/VoteRecordManager');
const AuditLogManager = require('../database/AuditLogManager');
const DataExportManager = require('../database/DataExportManager');
const { exportCleanupService } = require('../utils/exportCleanupService');

// Import enhanced authentication middleware
const { 
  requireAdmin, 
  optionalAdmin, 
  authenticateLogin, 
  destroySession, 
  getSessionStats,
  cleanupExpiredSessions 
} = require('../middleware/adminAuth');

const router = express.Router();

// Admin login endpoint
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_PASSWORD',
        message: '请输入管理员密码'
      });
    }
    
    const authResult = authenticateLogin(password, req);
    
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        errorCode: 'INVALID_PASSWORD',
        message: '管理员密码错误'
      });
    }
    
    res.json({
      success: true,
      token: authResult.token,
      session: authResult.session,
      message: '登录成功'
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'LOGIN_FAILED',
      message: '登录失败，请重试'
    });
  }
});

// Admin logout endpoint
router.post('/logout', requireAdmin, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const destroyed = destroySession(token);
    
    res.json({
      success: true,
      message: destroyed ? '登出成功' : '会话已失效',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'LOGOUT_FAILED',
      message: '登出失败，请重试'
    });
  }
});

// Get session info endpoint
router.get('/session', requireAdmin, async (req, res) => {
  try {
    const session = req.adminSession;
    
    res.json({
      success: true,
      session: {
        adminId: session.adminId,
        createdAt: session.createdAt,
        lastAccessAt: session.lastAccessAt,
        expiresAt: session.expiresAt,
        remainingTime: session.remainingTime,
        ipAddress: session.ipAddress
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get session info error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_SESSION_FAILED',
      message: '获取会话信息失败'
    });
  }
});

// Get session statistics (for monitoring)
router.get('/session/stats', requireAdmin, async (req, res) => {
  try {
    const stats = getSessionStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_SESSION_STATS_FAILED',
      message: '获取会话统计失败'
    });
  }
});

// Manual session cleanup endpoint
router.post('/session/cleanup', requireAdmin, async (req, res) => {
  try {
    const cleanedCount = cleanupExpiredSessions();
    
    res.json({
      success: true,
      cleanedSessions: cleanedCount,
      message: `清理了 ${cleanedCount} 个过期会话`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'SESSION_CLEANUP_FAILED',
      message: '会话清理失败'
    });
  }
});

// Get admin dashboard data
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    // 获取统计数据
    const statistics = await getVoteStatistics();
    
    // 获取排名数据
    const ranking = await getRanking();
    
    // 获取最近投票活动
    const recentActivity = await getRecentVotes(20);
    
    // 获取所有用户（用于详细分析）
    const allUsers = await getAllUsers();
    
    res.json({
      success: true,
      dashboard: {
        statistics,
        ranking,
        recentActivity,
        userCount: allUsers.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'DASHBOARD_FAILED',
      message: '获取管理数据失败'
    });
  }
});

// Export results
router.get('/export', requireAdmin, async (req, res) => {
  try {
    // 获取完整的投票结果数据
    const statistics = await getVoteStatistics();
    const ranking = await getRanking();
    const allUsers = await getAllUsers();
    const recentVotes = await getRecentVotes(1000); // 获取更多历史记录
    
    // 生成获奖名单
    const winners = {
      male: ranking.male.slice(0, 3).map((user, index) => ({
        rank: index + 1,
        name: user.name,
        voteCount: user.voteCount,
        prize: ['一等奖', '二等奖', '三等奖'][index]
      })),
      female: ranking.female.slice(0, 3).map((user, index) => ({
        rank: index + 1,
        name: user.name,
        voteCount: user.voteCount,
        prize: ['一等奖', '二等奖', '三等奖'][index]
      }))
    };
    
    const exportData = {
      exportTime: new Date().toISOString(),
      statistics,
      ranking,
      winners,
      allUsers: allUsers.map(user => ({
        id: user.id,
        name: user.name,
        gender: user.gender,
        voteCount: user.voteCount,
        createdAt: user.createdAt
      })),
      recentVotes: recentVotes.map(vote => ({
        targetName: vote.targetName,
        targetGender: vote.targetGender,
        voterName: vote.voterName,
        voteTime: vote.voteTime
      })),
      summary: {
        totalParticipants: statistics.totalParticipants,
        totalVotes: statistics.totalVotes,
        maleParticipants: statistics.maleParticipants,
        femaleParticipants: statistics.femaleParticipants,
        exportedAt: new Date().toLocaleString('zh-CN')
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=voting-results-${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);
    
  } catch (error) {
    console.error('Export results error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'EXPORT_FAILED',
      message: '导出结果失败'
    });
  }
});

// Get winners list
router.get('/winners', requireAdmin, async (req, res) => {
  try {
    const ranking = await getRanking();
    
    const winners = {
      male: ranking.male.slice(0, 3).map((user, index) => ({
        rank: index + 1,
        name: user.name,
        voteCount: user.voteCount,
        avatarUrl: user.avatarUrl,
        prize: ['一等奖', '二等奖', '三等奖'][index]
      })),
      female: ranking.female.slice(0, 3).map((user, index) => ({
        rank: index + 1,
        name: user.name,
        voteCount: user.voteCount,
        avatarUrl: user.avatarUrl,
        prize: ['一等奖', '二等奖', '三等奖'][index]
      }))
    };
    
    res.json({
      success: true,
      winners,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get winners error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_WINNERS_FAILED',
      message: '获取获奖名单失败'
    });
  }
});

// Clear all data
router.post('/clear-data', requireAdmin, async (req, res) => {
  try {
    await clearAllData();
    
    res.json({
      success: true,
      message: '所有数据已清空',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Clear data error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'CLEAR_DATA_FAILED',
      message: '清空数据失败'
    });
  }
});

// Create data backup
router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const backupData = await createDataBackup();
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=voting-backup-${new Date().toISOString().split('T')[0]}.json`);
    
    res.json(backupData);
    
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'BACKUP_FAILED',
      message: '创建数据备份失败'
    });
  }
});

// Archive data and clear (safe data management)
router.post('/archive-and-clear', requireAdmin, async (req, res) => {
  try {
    const { includeFiles = true } = req.body;
    const result = await archiveAndClearData(includeFiles);
    
    // Set headers for backup file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=voting-archive-${new Date().toISOString().split('T')[0]}.json`);
    
    res.json(result);
    
  } catch (error) {
    console.error('Archive and clear error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'ARCHIVE_CLEAR_FAILED',
      message: '数据归档和清空失败'
    });
  }
});

// Get database management information
router.get('/database-info', requireAdmin, async (req, res) => {
  try {
    const dbInfo = await getDatabaseInfo();
    
    res.json({
      success: true,
      databaseInfo: dbInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get database info error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'DATABASE_INFO_FAILED',
      message: '获取数据库信息失败'
    });
  }
});

// Get detailed user list
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, gender, sortBy = 'voteCount' } = req.query;
    
    let users = await getAllUsers();
    
    // 按性别过滤
    if (gender && ['male', 'female'].includes(gender)) {
      users = users.filter(user => user.gender === gender);
    }
    
    // 排序
    if (sortBy === 'voteCount') {
      users.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
    } else if (sortBy === 'name') {
      users.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'createdAt') {
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // 分页
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.length,
        totalPages: Math.ceil(users.length / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_USERS_FAILED',
      message: '获取用户列表失败'
    });
  }
});

// ===== 投票记录管理 API =====

// GET /api/admin/vote-records - 获取投票记录列表
router.get('/vote-records', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      voter,
      candidate,
      dateFrom,
      dateTo,
      voteMethod,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      search
    } = req.query;

    console.log('Vote records query params:', { page, limit, status, voter, candidate, dateFrom, dateTo, voteMethod, sortBy, sortOrder, search }); // 调试日志

    const voteRecordManager = new VoteRecordManager();

    // 构建筛选条件
    const filters = {};
    if (status) filters.status = status;
    if (voter) filters.voter = voter;
    if (candidate) filters.candidate = candidate;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (voteMethod) filters.voteMethod = voteMethod;

    console.log('Filters object:', filters); // 调试日志
    
    // 构建分页参数
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };
    
    let result;
    if (search && search.trim()) {
      // 使用搜索功能
      result = await voteRecordManager.searchVoteRecords(search.trim(), filters, pagination);
    } else {
      // 使用普通筛选
      result = await voteRecordManager.getVoteRecords(filters, pagination);
    }
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get vote records error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_VOTE_RECORDS_FAILED',
      message: '获取投票记录失败',
      error: error.message
    });
  }
});

// GET /api/admin/vote-records/:id - 获取投票记录详情
router.get('/vote-records/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_VOTE_ID',
        message: '无效的投票记录ID'
      });
    }
    
    const voteRecordManager = new VoteRecordManager();
    const voteRecord = await voteRecordManager.getVoteRecordDetail(parseInt(id));
    
    if (!voteRecord) {
      return res.status(404).json({
        success: false,
        errorCode: 'VOTE_RECORD_NOT_FOUND',
        message: '投票记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: voteRecord,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get vote record detail error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_VOTE_RECORD_DETAIL_FAILED',
      message: '获取投票记录详情失败',
      error: error.message
    });
  }
});

// PUT /api/admin/vote-records/:id/status - 更新投票记录状态
router.put('/vote-records/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_VOTE_ID',
        message: '无效的投票记录ID'
      });
    }
    
    if (!status || !['active', 'inactive', 'disabled', 'discarded'].includes(status)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_STATUS',
        message: '状态值必须是 active、inactive、disabled 或 discarded'
      });
    }
    
    // 从会话中获取管理员ID
    const adminId = req.adminId;
    
    const voteRecordManager = new VoteRecordManager();
    const result = await voteRecordManager.updateVoteStatus(
      parseInt(id), 
      status, 
      adminId, 
      reason
    );
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Update vote status error:', error);
    
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        errorCode: 'VOTE_RECORD_NOT_FOUND',
        message: error.message
      });
    }
    
    if (error.message.includes('状态值')) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_STATUS',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      errorCode: 'UPDATE_VOTE_STATUS_FAILED',
      message: '更新投票记录状态失败',
      error: error.message
    });
  }
});

// PUT /api/admin/vote-records/batch-status - 批量更新投票记录状态
router.put('/vote-records/batch-status', requireAdmin, async (req, res) => {
  try {
    const { voteIds, status, reason } = req.body;
    
    if (!Array.isArray(voteIds) || voteIds.length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_VOTE_IDS',
        message: '投票记录ID数组不能为空'
      });
    }
    
    if (!status || !['active', 'inactive', 'disabled', 'discarded'].includes(status)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_STATUS',
        message: '状态值必须是 active、inactive、disabled 或 discarded'
      });
    }
    
    // 验证所有ID都是数字
    const invalidIds = voteIds.filter(id => isNaN(parseInt(id)));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_VOTE_IDS',
        message: `无效的投票记录ID: ${invalidIds.join(', ')}`
      });
    }
    
    // 从会话中获取管理员ID
    const adminId = req.adminId;
    
    const voteRecordManager = new VoteRecordManager();
    const result = await voteRecordManager.batchUpdateVoteStatus(
      voteIds.map(id => parseInt(id)), 
      status, 
      adminId, 
      reason
    );
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Batch update vote status error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'BATCH_UPDATE_VOTE_STATUS_FAILED',
      message: '批量更新投票记录状态失败',
      error: error.message
    });
  }
});

// GET /api/admin/vote-records/:id/history - 获取投票记录操作历史
router.get('/vote-records/:id/history', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, sortOrder = 'DESC' } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_VOTE_ID',
        message: '无效的投票记录ID'
      });
    }
    
    const auditLogManager = new AuditLogManager();
    const options = {};
    if (limit) options.limit = parseInt(limit);
    if (sortOrder) options.sortOrder = sortOrder;
    
    const history = await auditLogManager.getVoteOperationHistory(parseInt(id), options);
    
    res.json({
      success: true,
      data: {
        voteId: parseInt(id),
        history,
        total: history.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get vote operation history error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_VOTE_HISTORY_FAILED',
      message: '获取投票记录操作历史失败',
      error: error.message
    });
  }
});

// ===== 数据导出 API =====

// POST /api/admin/export/vote-records - 创建导出任务
router.post('/export/vote-records', requireAdmin, async (req, res) => {
  try {
    const {
      format = 'csv', // 'csv' 或 'excel'
      filters = {},
      columns = null
    } = req.body;
    
    if (!['csv', 'excel'].includes(format)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_FORMAT',
        message: '导出格式必须是 csv 或 excel'
      });
    }
    
    // 从会话中获取管理员ID
    const adminId = req.adminId;
    
    const dataExportManager = new DataExportManager();
    
    let exportResult;
    if (format === 'csv') {
      exportResult = await dataExportManager.exportToCSV(filters, columns);
    } else {
      exportResult = await dataExportManager.exportToExcel(filters, columns);
    }
    
    // 创建导出任务记录
    const taskRecord = await dataExportManager.createExportTask(
      adminId,
      exportResult.filePath,
      format,
      filters
    );
    
    // 生成下载链接
    const downloadInfo = await dataExportManager.generateDownloadLink(exportResult.filePath);
    
    res.json({
      success: true,
      data: {
        taskId: taskRecord.taskId,
        filename: exportResult.filename,
        recordCount: exportResult.recordCount,
        fileSize: exportResult.fileSize,
        format,
        downloadUrl: downloadInfo.downloadUrl,
        expiresAt: downloadInfo.expiresAt,
        createdAt: exportResult.createdAt
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Export vote records error:', error);
    
    if (error.message.includes('没有符合条件的数据')) {
      return res.status(400).json({
        success: false,
        errorCode: 'NO_DATA_TO_EXPORT',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      errorCode: 'EXPORT_FAILED',
      message: '导出投票记录失败',
      error: error.message
    });
  }
});

// GET /api/admin/export/:taskId/download - 下载导出文件
router.get('/export/:taskId/download', requireAdmin, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId || isNaN(parseInt(taskId))) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_TASK_ID',
        message: '无效的任务ID'
      });
    }
    
    const dataExportManager = new DataExportManager();
    const task = await dataExportManager.getExportTask(parseInt(taskId));
    
    if (!task) {
      return res.status(404).json({
        success: false,
        errorCode: 'TASK_NOT_FOUND',
        message: '导出任务不存在'
      });
    }
    
    // 检查任务是否过期
    const now = new Date();
    const expiresAt = new Date(task.expiresAt);
    if (now > expiresAt) {
      return res.status(410).json({
        success: false,
        errorCode: 'TASK_EXPIRED',
        message: '导出文件已过期'
      });
    }
    
    // 检查文件是否存在
    const fs = require('fs').promises;
    try {
      await fs.access(task.filePath);
    } catch (fileError) {
      return res.status(404).json({
        success: false,
        errorCode: 'FILE_NOT_FOUND',
        message: '导出文件不存在'
      });
    }
    
    // 设置下载响应头
    const path = require('path');
    const filename = path.basename(task.filePath);
    const contentType = task.fileType === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // 发送文件
    res.sendFile(task.filePath, (err) => {
      if (err) {
        console.error('Send file error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            errorCode: 'DOWNLOAD_FAILED',
            message: '文件下载失败'
          });
        }
      }
    });
    
  } catch (error) {
    console.error('Download export file error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'DOWNLOAD_FAILED',
      message: '下载导出文件失败',
      error: error.message
    });
  }
});

// GET /api/admin/export/cleanup/status - 获取清理服务状态
router.get('/export/cleanup/status', requireAdmin, async (req, res) => {
  try {
    const status = exportCleanupService.getStatus();
    const directoryStats = await exportCleanupService.getExportDirectoryStats();
    
    res.json({
      success: true,
      data: {
        service: status,
        directory: directoryStats
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get cleanup status error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_CLEANUP_STATUS_FAILED',
      message: '获取清理服务状态失败',
      error: error.message
    });
  }
});

// POST /api/admin/export/cleanup/manual - 手动触发清理
router.post('/export/cleanup/manual', requireAdmin, async (req, res) => {
  try {
    const { maxFileAgeHours = 24 } = req.body;
    
    if (maxFileAgeHours < 1 || maxFileAgeHours > 168) { // 1小时到7天
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_MAX_AGE',
        message: '文件保存时间必须在1-168小时之间'
      });
    }
    
    const result = await exportCleanupService.manualCleanup(maxFileAgeHours);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'MANUAL_CLEANUP_FAILED',
      message: '手动清理失败',
      error: error.message
    });
  }
});

module.exports = router;