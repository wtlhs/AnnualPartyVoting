const request = require('supertest');
const express = require('express');

// Mock the database operations before importing the routes
jest.mock('../database/operations', () => ({
  getUserById: jest.fn(),
  recordVote: jest.fn(),
  checkVoteRestrictions: jest.fn(),
  updateVoteRestrictions: jest.fn(),
  canVoteForGender: jest.fn(),
  getVoteStatistics: jest.fn(),
  getRanking: jest.fn(),
  getVotesForUser: jest.fn(),
  getAllUsers: jest.fn(),
  getRecentVotes: jest.fn(),
  getVotingProgress: jest.fn(),
  clearAllData: jest.fn()
}));

const voteRoutes = require('./votes');
const mockOperations = require('../database/operations');

const app = express();
app.use(express.json());
app.use('/api/votes', voteRoutes);

describe('Vote Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any test data
    try {
      await mockOperations.clearAllData();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('POST /api/votes', () => {
    it('should successfully record a vote', async () => {
      const mockTargetUser = {
        id: 'user123',
        name: '张三',
        gender: 'male',
        voteCount: 5
      };

      const mockVote = {
        id: 1,
        voterId: 'voter123',
        targetUserId: 'user123',
        voteTime: new Date().toISOString()
      };

      const mockUpdatedUser = {
        ...mockTargetUser,
        voteCount: 6
      };

      const mockRestrictions = {
        voterId: 'voter123',
        maleVoted: true,
        femaleVoted: false,
        votedUsers: [{ userId: 'user123', name: '张三', gender: 'male' }]
      };

      // Mock database operations
      mockOperations.getUserById.mockResolvedValue(mockTargetUser);
      mockOperations.canVoteForGender.mockResolvedValue(true);
      mockOperations.recordVote.mockResolvedValue(mockVote);
      mockOperations.updateVoteRestrictions.mockResolvedValue(mockRestrictions);
      mockOperations.getUserById.mockResolvedValueOnce(mockTargetUser).mockResolvedValueOnce(mockUpdatedUser);

      const response = await request(app)
        .post('/api/votes')
        .send({
          voterId: 'voter123',
          targetUserId: 'user123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('投票成功！');
      expect(response.body.vote.targetUser.name).toBe('张三');
      expect(response.body.vote.targetUser.voteCount).toBe(6);
    });

    it('should reject vote when voter has already voted for same gender', async () => {
      const mockTargetUser = {
        id: 'user123',
        name: '张三',
        gender: 'male',
        voteCount: 5
      };

      const mockRestrictions = {
        voterId: 'voter123',
        maleVoted: true,
        femaleVoted: false,
        maleVotedName: '李四',
        femaleVotedName: null
      };

      mockOperations.getUserById.mockResolvedValue(mockTargetUser);
      mockOperations.canVoteForGender.mockResolvedValue(false);
      mockOperations.checkVoteRestrictions.mockResolvedValue(mockRestrictions);

      const response = await request(app)
        .post('/api/votes')
        .send({
          voterId: 'voter123',
          targetUserId: 'user123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('DUPLICATE_VOTE');
      expect(response.body.message).toContain('您已经为男士参与者投过票了');
      expect(response.body.details.votedUser).toBe('李四');
    });

    it('should prevent self-voting', async () => {
      const response = await request(app)
        .post('/api/votes')
        .send({
          voterId: 'user123',
          targetUserId: 'user123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('SELF_VOTE_NOT_ALLOWED');
      expect(response.body.message).toBe('不能为自己投票');
      expect(response.body.details.reason).toBe('系统不允许为自己投票');
      expect(response.body.details.allowedActions).toContain('为其他参与者投票');
    });

    it('should reject vote when target user does not exist', async () => {
      mockOperations.getUserById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/votes')
        .send({
          voterId: 'voter123',
          targetUserId: 'nonexistent'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TARGET_USER_NOT_FOUND');
    });

    it('should reject vote when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/votes')
        .send({
          voterId: 'voter123'
          // Missing targetUserId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('GET /api/votes/status/:voterId', () => {
    it('should return vote status for a voter', async () => {
      const mockRestrictions = {
        voterId: 'voter123',
        maleVoted: true,
        femaleVoted: false,
        votedUsers: [
          { userId: 'user123', name: '张三', gender: 'male' }
        ]
      };

      mockOperations.checkVoteRestrictions.mockResolvedValue(mockRestrictions);

      const response = await request(app)
        .get('/api/votes/status/voter123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.maleVoted).toBe(true);
      expect(response.body.femaleVoted).toBe(false);
      expect(response.body.canVoteForMale).toBe(false);
      expect(response.body.canVoteForFemale).toBe(true);
      expect(response.body.isComplete).toBe(false);
    });

    it('should reject request when voter ID is missing', async () => {
      const response = await request(app)
        .get('/api/votes/status/');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/votes/ranking', () => {
    it('should return ranking for all genders', async () => {
      const mockRanking = {
        male: [
          { userId: 'user1', name: '张三', avatarUrl: '/avatar1.jpg', voteCount: 10, rank: 1 },
          { userId: 'user2', name: '李四', avatarUrl: '/avatar2.jpg', voteCount: 8, rank: 2 }
        ],
        female: [
          { userId: 'user3', name: '王五', avatarUrl: '/avatar3.jpg', voteCount: 12, rank: 1 },
          { userId: 'user4', name: '赵六', avatarUrl: '/avatar4.jpg', voteCount: 9, rank: 2 }
        ]
      };

      mockOperations.getRanking.mockResolvedValue(mockRanking);

      const response = await request(app)
        .get('/api/votes/ranking');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ranking).toEqual(mockRanking);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return ranking filtered by gender', async () => {
      const mockRanking = {
        male: [
          { userId: 'user1', name: '张三', avatarUrl: '/avatar1.jpg', voteCount: 10, rank: 1 }
        ],
        female: []
      };

      mockOperations.getRanking.mockResolvedValue(mockRanking);

      const response = await request(app)
        .get('/api/votes/ranking?gender=male');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockOperations.getRanking).toHaveBeenCalledWith('male');
    });

    it('should reject invalid gender parameter', async () => {
      const response = await request(app)
        .get('/api/votes/ranking?gender=invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_GENDER');
    });
  });

  describe('GET /api/votes/statistics', () => {
    it('should return vote statistics', async () => {
      const mockStatistics = {
        totalParticipants: 20,
        totalVotes: 35,
        maleParticipants: 10,
        femaleParticipants: 10,
        maleVotes: 18,
        femaleVotes: 17
      };

      mockOperations.getVoteStatistics.mockResolvedValue(mockStatistics);

      const response = await request(app)
        .get('/api/votes/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toEqual(mockStatistics);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/votes/check-eligibility', () => {
    it('should return eligibility status when voter can vote', async () => {
      const mockTargetUser = {
        id: 'user123',
        name: '张三',
        gender: 'male',
        avatarUrl: '/avatar.jpg',
        voteCount: 5
      };

      const mockRestrictions = {
        voterId: 'voter123',
        maleVoted: false,
        femaleVoted: true,
        votedUsers: [
          { userId: 'user456', name: '王五', gender: 'female' }
        ]
      };

      mockOperations.getUserById.mockResolvedValue(mockTargetUser);
      mockOperations.canVoteForGender.mockResolvedValue(true);
      mockOperations.checkVoteRestrictions.mockResolvedValue(mockRestrictions);

      const response = await request(app)
        .post('/api/votes/check-eligibility')
        .send({
          voterId: 'voter123',
          targetUserId: 'user123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canVote).toBe(true);
      expect(response.body.targetUser.name).toBe('张三');
      expect(response.body.voterStatus.maleVoted).toBe(false);
      expect(response.body.voterStatus.femaleVoted).toBe(true);
      expect(response.body.reason).toBeNull();
    });

    it('should return eligibility status when voter cannot vote', async () => {
      const mockTargetUser = {
        id: 'user123',
        name: '张三',
        gender: 'male',
        avatarUrl: '/avatar.jpg',
        voteCount: 5
      };

      const mockRestrictions = {
        voterId: 'voter123',
        maleVoted: true,
        femaleVoted: false,
        votedUsers: [
          { userId: 'user789', name: '李四', gender: 'male' }
        ]
      };

      mockOperations.getUserById.mockResolvedValue(mockTargetUser);
      mockOperations.canVoteForGender.mockResolvedValue(false);
      mockOperations.checkVoteRestrictions.mockResolvedValue(mockRestrictions);

      const response = await request(app)
        .post('/api/votes/check-eligibility')
        .send({
          voterId: 'voter123',
          targetUserId: 'user123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canVote).toBe(false);
      expect(response.body.reason).toContain('您已经为男士参与者投过票了');
    });

    it('should prevent self-voting eligibility check', async () => {
      const response = await request(app)
        .post('/api/votes/check-eligibility')
        .send({
          voterId: 'user123',
          targetUserId: 'user123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.canVote).toBe(false);
      expect(response.body.reason).toBe('不能为自己投票');
      expect(response.body.errorCode).toBe('SELF_VOTE_NOT_ALLOWED');
      expect(response.body.targetUser).toBe(null);
      expect(response.body.voterStatus).toBe(null);
    });
  });

  describe('GET /api/votes/progress', () => {
    it('should return voting progress statistics', async () => {
      const mockProgress = {
        activeVoters: 25,
        maleVotesCast: 20,
        femaleVotesCast: 18,
        completedVoters: 15,
        votingCompletionRate: '60.00'
      };

      mockOperations.getVotingProgress.mockResolvedValue(mockProgress);

      const response = await request(app)
        .get('/api/votes/progress');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.progress).toEqual(mockProgress);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/votes/history/:userId', () => {
    it('should return vote history for a user', async () => {
      const mockUser = {
        id: 'user123',
        name: '张三',
        gender: 'male',
        avatarUrl: '/avatar.jpg',
        voteCount: 5
      };

      const mockVotes = [
        {
          id: 1,
          voterId: 'voter1',
          voterName: '李四',
          targetUserId: 'user123',
          voteTime: '2023-12-01T10:00:00Z',
          ipAddress: '192.168.1.1'
        },
        {
          id: 2,
          voterId: 'voter2',
          voterName: '王五',
          targetUserId: 'user123',
          voteTime: '2023-12-01T11:00:00Z',
          ipAddress: '192.168.1.2'
        }
      ];

      mockOperations.getUserById.mockResolvedValue(mockUser);
      mockOperations.getVotesForUser.mockResolvedValue(mockVotes);

      const response = await request(app)
        .get('/api/votes/history/user123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('张三');
      expect(response.body.votes).toHaveLength(2);
      expect(response.body.votes[0].voterName).toBe('李四');
    });

    it('should return 404 when user does not exist', async () => {
      mockOperations.getUserById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/votes/history/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('USER_NOT_FOUND');
    });
  });

  describe('GET /api/votes/top-performers', () => {
    it('should return top 3 performers for each gender', async () => {
      const mockRanking = {
        male: [
          { userId: 'user1', name: '张三', avatarUrl: '/avatar1.jpg', voteCount: 15, rank: 1 },
          { userId: 'user2', name: '李四', avatarUrl: '/avatar2.jpg', voteCount: 12, rank: 2 },
          { userId: 'user3', name: '王五', avatarUrl: '/avatar3.jpg', voteCount: 10, rank: 3 },
          { userId: 'user4', name: '赵六', avatarUrl: '/avatar4.jpg', voteCount: 8, rank: 4 }
        ],
        female: [
          { userId: 'user5', name: '小红', avatarUrl: '/avatar5.jpg', voteCount: 18, rank: 1 },
          { userId: 'user6', name: '小明', avatarUrl: '/avatar6.jpg', voteCount: 14, rank: 2 },
          { userId: 'user7', name: '小李', avatarUrl: '/avatar7.jpg', voteCount: 11, rank: 3 }
        ]
      };

      mockOperations.getRanking.mockResolvedValue(mockRanking);

      const response = await request(app)
        .get('/api/votes/top-performers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.topPerformers.male).toHaveLength(3);
      expect(response.body.topPerformers.female).toHaveLength(3);
      expect(response.body.topPerformers.male[0].name).toBe('张三');
      expect(response.body.topPerformers.female[0].name).toBe('小红');
    });
  });

  describe('GET /api/votes/recent-activity', () => {
    it('should return recent voting activity', async () => {
      const mockRecentVotes = [
        {
          id: 1,
          voterId: 'voter1',
          voterName: '李四',
          targetUserId: 'user1',
          targetName: '张三',
          targetGender: 'male',
          targetAvatar: '/avatar1.jpg',
          voteTime: '2023-12-01T12:00:00Z',
          ipAddress: '192.168.1.1'
        },
        {
          id: 2,
          voterId: 'voter2',
          voterName: '王五',
          targetUserId: 'user2',
          targetName: '小红',
          targetGender: 'female',
          targetAvatar: '/avatar2.jpg',
          voteTime: '2023-12-01T11:30:00Z',
          ipAddress: '192.168.1.2'
        }
      ];

      mockOperations.getRecentVotes.mockResolvedValue(mockRecentVotes);

      const response = await request(app)
        .get('/api/votes/recent-activity?limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recentActivity).toHaveLength(2);
      expect(response.body.recentActivity[0].targetName).toBe('张三');
      expect(mockOperations.getRecentVotes).toHaveBeenCalledWith(5);
    });
  });

  describe('POST /api/votes/clear-cache', () => {
    it('should clear cache successfully', async () => {
      const response = await request(app)
        .post('/api/votes/clear-cache');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('缓存已清除');
    });
  });

  describe('Caching functionality', () => {
    it('should use cache for statistics when available', async () => {
      const mockStatistics = {
        totalParticipants: 20,
        totalVotes: 35,
        maleParticipants: 10,
        femaleParticipants: 10,
        maleVotes: 18,
        femaleVotes: 17
      };

      // Clear previous mock calls
      mockOperations.getVoteStatistics.mockClear();
      mockOperations.getVoteStatistics.mockResolvedValue(mockStatistics);

      // Clear cache first
      await request(app).post('/api/votes/clear-cache');

      // First request should hit database
      const response1 = await request(app)
        .get('/api/votes/statistics');

      expect(response1.status).toBe(200);
      expect(mockOperations.getVoteStatistics).toHaveBeenCalledTimes(1);

      // Second request within cache TTL should use cache
      const response2 = await request(app)
        .get('/api/votes/statistics');

      expect(response2.status).toBe(200);
      expect(response2.body.cached).toBe(true);
      
      // Database should still only be called once
      expect(mockOperations.getVoteStatistics).toHaveBeenCalledTimes(1);
    });
  });
});