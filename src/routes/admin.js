const express = require('express');
const { 
  getVoteStatistics, 
  getRanking, 
  clearAllData,
  getAllUsers,
  getRecentVotes
} = require('../database/operations');

const router = express.Router();

// 简单的管理员密码验证（生产环境应使用更安全的方式）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Admin authentication middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '需要管理员权限'
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // 简单的密码验证（生产环境应使用JWT或其他安全方式）
  if (token !== ADMIN_PASSWORD) {
    return res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN',
      message: '管理员密码错误'
    });
  }
  
  next();
}

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
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        errorCode: 'INVALID_PASSWORD',
        message: '管理员密码错误'
      });
    }
    
    res.json({
      success: true,
      token: password, // 简单实现，生产环境应使用JWT
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

module.exports = router;