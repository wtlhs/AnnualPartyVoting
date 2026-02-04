const express = require('express');
const { 
  getUserById, 
  recordVote, 
  checkVoteRestrictions, 
  updateVoteRestrictions, 
  canVoteForGender,
  getVoteStatistics,
  getRanking,
  getVotesForUser,
  getAllUsers,
  getRecentVotes,
  getVotingProgress
} = require('../database/operations');
const VotingSettingsManager = require('../database/VotingSettingsManager');

const router = express.Router();
const votingSettings = new VotingSettingsManager();

// Simple in-memory cache for performance optimization
const cache = {
  statistics: null,
  ranking: null,
  lastUpdate: null,
  ttl: 30000 // 30 seconds TTL
};

// Helper function to check if cache is valid
function isCacheValid() {
  return cache.lastUpdate && (Date.now() - cache.lastUpdate) < cache.ttl;
}

// Helper function to clear cache
function clearCache() {
  cache.statistics = null;
  cache.ranking = null;
  cache.lastUpdate = null;
}

// Vote for a participant
router.post('/', async (req, res) => {
  try {
    const { voterId, targetUserId } = req.body;
    
    // Validate input
    if (!voterId || !targetUserId) {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_REQUIRED_FIELDS',
        message: '投票者ID和目标用户ID不能为空'
      });
    }
    
    // Check voting status first
    const votingStatus = await votingSettings.getVotingStatus();
    if (!votingStatus.canVote) {
      return res.status(403).json({
        success: false,
        errorCode: 'VOTING_DISABLED',
        message: votingStatus.message,
        details: {
          votingEnabled: votingStatus.enabled,
          withinTimeRange: votingStatus.withinTimeRange,
          reason: votingStatus.enabled ? 'TIME_RESTRICTION' : 'VOTING_DISABLED'
        }
      });
    }
    
    // Check for self-voting
    if (voterId === targetUserId) {
      return res.status(400).json({
        success: false,
        errorCode: 'SELF_VOTE_NOT_ALLOWED',
        message: '不能为自己投票',
        details: {
          reason: '系统不允许为自己投票',
          allowedActions: ['为其他参与者投票', '查看投票结果']
        }
      });
    }
    
    // Check if target user exists
    const targetUser = await getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        errorCode: 'TARGET_USER_NOT_FOUND',
        message: '被投票的用户不存在'
      });
    }
    
    // Check if voter can vote for this gender
    const canVote = await canVoteForGender(voterId, targetUser.gender);
    if (!canVote) {
      // Get current vote restrictions to provide detailed feedback
      const restrictions = await checkVoteRestrictions(voterId);
      const votedUser = targetUser.gender === 'male' ? 
        restrictions.maleVotedName : restrictions.femaleVotedName;
      
      // Determine allowed actions based on remaining votes
      const allowedActions = [];
      
      // Check if they can vote for the OTHER gender
      if (targetUser.gender === 'male') {
          // If they tried to vote for male (and failed), check if they can vote for female
          if (!restrictions.femaleVoted) {
              allowedActions.push('为女士参与者投票');
          }
      } else {
          // If they tried to vote for female (and failed), check if they can vote for male
          if (!restrictions.maleVoted) {
              allowedActions.push('为男士参与者投票');
          }
      }
      
      // Always allowed actions
      allowedActions.push('查看结果');
      allowedActions.push('返回首页');
      
      return res.status(400).json({
        success: false,
        errorCode: 'DUPLICATE_VOTE',
        message: `您已经为${targetUser.gender === 'male' ? '男士' : '女士'}参与者投过票了`,
        details: {
          votedUser: votedUser,
          targetGender: targetUser.gender === 'male' ? '男士' : '女士',
          allowedActions: allowedActions
        }
      });
    }
    
    // Get client IP address for logging
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
      (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // Record the vote
    const vote = await recordVote({
      voterId,
      targetUserId,
      ipAddress
    });
    
    // Update vote restrictions and get updated status
    const userVotingStatus = await updateVoteRestrictions(voterId, targetUserId, targetUser.gender);
    
    // Clear cache after vote to ensure real-time updates
    clearCache();
    
    // Get updated user info with new vote count
    const updatedTargetUser = await getUserById(targetUserId);
    
    res.json({
      success: true,
      message: '投票成功！',
      vote: {
        id: vote.id,
        targetUser: {
          name: updatedTargetUser.name,
          gender: updatedTargetUser.gender,
          voteCount: updatedTargetUser.voteCount
        },
        voteTime: vote.voteTime
      },
      votingStatus: {
        maleVoted: userVotingStatus.maleVoted,
        femaleVoted: userVotingStatus.femaleVoted,
        remainingVotes: {
          male: userVotingStatus.maleVoted ? 0 : 1,
          female: userVotingStatus.femaleVoted ? 0 : 1
        }
      }
    });
    
  } catch (error) {
    console.error('Vote submission error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'VOTE_SUBMISSION_FAILED',
      message: '投票提交失败，请稍后重试'
    });
  }
});

// Check vote status for a voter
router.get('/status/:voterId', async (req, res) => {
  try {
    const { voterId } = req.params;
    
    if (!voterId) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_VOTER_ID',
        message: '投票者ID不能为空'
      });
    }
    
    const restrictions = await checkVoteRestrictions(voterId);
    
    res.json({
      success: true,
      voterId: restrictions.voterId,
      maleVoted: restrictions.maleVoted,
      femaleVoted: restrictions.femaleVoted,
      votedUsers: restrictions.votedUsers,
      canVoteForMale: !restrictions.maleVoted,
      canVoteForFemale: !restrictions.femaleVoted,
      isComplete: restrictions.maleVoted && restrictions.femaleVoted
    });
    
  } catch (error) {
    console.error('Vote status check error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'VOTE_STATUS_CHECK_FAILED',
      message: '投票状态查询失败'
    });
  }
});

// Get ranking
router.get('/ranking', async (req, res) => {
  try {
    const { gender } = req.query;
    
    // Validate gender parameter if provided
    if (gender && !['male', 'female'].includes(gender)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_GENDER',
        message: '性别参数必须是 male 或 female'
      });
    }
    
    // Check cache first for performance
    let ranking;
    if (!gender && isCacheValid() && cache.ranking) {
      ranking = cache.ranking;
    } else {
      ranking = await getRanking(gender);
      
      // Cache full ranking (not filtered by gender)
      if (!gender) {
        cache.ranking = ranking;
        cache.lastUpdate = Date.now();
      }
    }
    
    res.json({
      success: true,
      ranking: ranking,
      timestamp: new Date().toISOString(),
      cached: !gender && isCacheValid() && cache.ranking ? true : false
    });
    
  } catch (error) {
    console.error('Ranking query error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'RANKING_QUERY_FAILED',
      message: '排名查询失败'
    });
  }
});

// Get statistics
router.get('/statistics', async (req, res) => {
  try {
    // Check cache first for performance
    let statistics;
    if (isCacheValid() && cache.statistics) {
      statistics = cache.statistics;
    } else {
      statistics = await getVoteStatistics();
      cache.statistics = statistics;
      cache.lastUpdate = Date.now();
    }
    
    res.json({
      success: true,
      statistics: statistics,
      timestamp: new Date().toISOString(),
      cached: isCacheValid() && cache.statistics ? true : false
    });
    
  } catch (error) {
    console.error('Statistics query error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'STATISTICS_QUERY_FAILED',
      message: '统计数据查询失败'
    });
  }
});

// Get voting progress statistics
router.get('/progress', async (req, res) => {
  try {
    const progress = await getVotingProgress();
    
    res.json({
      success: true,
      progress: progress,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Voting progress query error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'VOTING_PROGRESS_QUERY_FAILED',
      message: '投票进度查询失败'
    });
  }
});

// Check if a voter can vote for a specific user
router.post('/check-eligibility', async (req, res) => {
  try {
    const { voterId, targetUserId } = req.body;
    
    if (!voterId || !targetUserId) {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_REQUIRED_FIELDS',
        message: '投票者ID和目标用户ID不能为空'
      });
    }
    
    // Check for self-voting
    if (voterId === targetUserId) {
      // Still fetch voter status to provide better context
      const restrictions = await checkVoteRestrictions(voterId);
      
      return res.json({
        success: true,
        canVote: false,
        targetUser: null,
        voterStatus: {
          maleVoted: restrictions.maleVoted,
          femaleVoted: restrictions.femaleVoted,
          votedUsers: restrictions.votedUsers
        },
        reason: '不能为自己投票',
        errorCode: 'SELF_VOTE_NOT_ALLOWED'
      });
    }
    
    // Check if target user exists
    const targetUser = await getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        errorCode: 'TARGET_USER_NOT_FOUND',
        message: '被投票的用户不存在'
      });
    }
    
    // Check voting eligibility
    const canVote = await canVoteForGender(voterId, targetUser.gender);
    const restrictions = await checkVoteRestrictions(voterId);
    
    res.json({
      success: true,
      canVote: canVote,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        gender: targetUser.gender,
        avatarUrl: targetUser.avatarUrl,
        voteCount: targetUser.voteCount
      },
      voterStatus: {
        maleVoted: restrictions.maleVoted,
        femaleVoted: restrictions.femaleVoted,
        votedUsers: restrictions.votedUsers
      },
      reason: canVote ? null : `您已经为${targetUser.gender === 'male' ? '男士' : '女士'}参与者投过票了`
    });
    
  } catch (error) {
    console.error('Vote eligibility check error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'ELIGIBILITY_CHECK_FAILED',
      message: '投票资格检查失败'
    });
  }
});

// Get detailed vote history for a specific user
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_USER_ID',
        message: '用户ID不能为空'
      });
    }
    
    // Check if user exists
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    }
    
    // Get vote history for this user
    const votes = await getVotesForUser(userId);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        gender: user.gender,
        avatarUrl: user.avatarUrl,
        voteCount: user.voteCount
      },
      votes: votes,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Vote history query error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'VOTE_HISTORY_QUERY_FAILED',
      message: '投票历史查询失败'
    });
  }
});

// Get top performers (top 3 for each gender)
router.get('/top-performers', async (req, res) => {
  try {
    const ranking = await getRanking();
    
    const topPerformers = {
      male: ranking.male.slice(0, 3),
      female: ranking.female.slice(0, 3)
    };
    
    res.json({
      success: true,
      topPerformers: topPerformers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Top performers query error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'TOP_PERFORMERS_QUERY_FAILED',
      message: '获奖者查询失败'
    });
  }
});

// Get real-time voting activity (recent votes)
router.get('/recent-activity', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get recent votes with user information
    const recentVotes = await getRecentVotes(parseInt(limit));
    
    // Filter out voter information for privacy protection
    const filteredActivity = recentVotes.map(vote => ({
      id: vote.id,
      targetUserId: vote.targetUserId,
      targetName: vote.targetName,
      targetGender: vote.targetGender,
      targetAvatar: vote.targetAvatar,
      voteTime: vote.voteTime
      // Removed: voterId, voterName, ipAddress for privacy
    }));
    
    res.json({
      success: true,
      recentActivity: filteredActivity,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Recent activity query error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'RECENT_ACTIVITY_QUERY_FAILED',
      message: '最近活动查询失败'
    });
  }
});

// Clear cache endpoint (for admin use)
router.post('/clear-cache', async (req, res) => {
  try {
    clearCache();
    
    res.json({
      success: true,
      message: '缓存已清除',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'CACHE_CLEAR_FAILED',
      message: '缓存清除失败'
    });
  }
});

module.exports = router;