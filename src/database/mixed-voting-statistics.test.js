/**
 * Property-Based Test for Mixed Voting Data Statistics
 * 
 * This test verifies that the statistics API correctly merges data from both
 * QR code voting and user list voting methods, ensuring data consistency
 * and accurate ranking calculations.
 * 
 * **Validates: Requirements 13.4, 13.5**
 */

const {
  createUser,
  getAllUsers,
  recordVote,
  atomicVote,
  getVoteStatistics,
  getRanking,
  getRecentVotes,
  getVotingProgress,
  clearAllData
} = require('./operations');
const { initializeDatabase } = require('./init');

describe('Mixed Voting Data Statistics', () => {
  beforeEach(async () => {
    await initializeDatabase();
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  /**
   * Property 20: Mixed Voting Data Consistency
   * For any mixed use of QR code voting and user list voting scenarios,
   * the system should maintain voting data consistency and accuracy,
   * and statistics results should correctly merge data from all voting methods
   * **Validates: Requirements 13.4, 13.5**
   */
  describe('Property 20: Mixed Voting Data Consistency', () => {
    test('should correctly merge statistics from both QR code and user list voting', async () => {
      // Create test users
      const male1 = await createUser({ name: '张三', gender: 'male' });
      const male2 = await createUser({ name: '李四', gender: 'male' });
      const female1 = await createUser({ name: '王五', gender: 'female' });
      const female2 = await createUser({ name: '赵六', gender: 'female' });
      
      // Create voters
      const voter1 = await createUser({ name: '投票者1', gender: 'male' });
      const voter2 = await createUser({ name: '投票者2', gender: 'female' });
      const voter3 = await createUser({ name: '投票者3', gender: 'male' });

      // Simulate QR code voting (using atomicVote which includes voter restrictions)
      await atomicVote({
        voterId: voter1.id,
        targetUserId: male1.id,
        targetGender: 'male',
        ipAddress: '192.168.1.100'
      });

      await atomicVote({
        voterId: voter1.id,
        targetUserId: female1.id,
        targetGender: 'female',
        ipAddress: '192.168.1.100'
      });

      // Simulate user list voting (using recordVote for direct voting)
      await recordVote({
        voterId: voter2.id,
        targetUserId: male1.id,
        ipAddress: '192.168.1.101'
      });

      await recordVote({
        voterId: voter2.id,
        targetUserId: female2.id,
        ipAddress: '192.168.1.101'
      });

      // Mix both methods for voter3
      await atomicVote({
        voterId: voter3.id,
        targetUserId: male2.id,
        targetGender: 'male',
        ipAddress: '192.168.1.102'
      });

      await recordVote({
        voterId: voter3.id,
        targetUserId: female1.id,
        ipAddress: '192.168.1.102'
      });

      // Add some anonymous votes (simulating votes without voter tracking)
      await recordVote({
        targetUserId: male1.id,
        ipAddress: '192.168.1.200'
      });

      await recordVote({
        targetUserId: female1.id,
        ipAddress: '192.168.1.201'
      });

      // Get statistics and verify they correctly merge all voting data
      const statistics = await getVoteStatistics();
      
      // Verify total counts
      expect(statistics.totalParticipants).toBe(7); // 4 participants + 3 voters
      expect(statistics.totalVotes).toBe(8); // All votes counted
      expect(statistics.maleParticipants).toBe(4); // male1, male2, voter1, voter3
      expect(statistics.femaleParticipants).toBe(3); // female1, female2, voter2
      expect(statistics.maleVotes).toBe(4); // votes for male1 (3) + male2 (1)
      expect(statistics.femaleVotes).toBe(4); // votes for female1 (3) + female2 (1)

      // Get ranking and verify it includes all votes regardless of method
      const ranking = await getRanking();
      
      // Verify male ranking
      expect(ranking.male).toHaveLength(4);
      
      // male1 should be first with 3 votes (2 tracked + 1 anonymous)
      const male1Ranking = ranking.male.find(u => u.userId === male1.id);
      expect(male1Ranking).toBeDefined();
      expect(male1Ranking.voteCount).toBe(3);
      expect(male1Ranking.rank).toBe(1);
      
      // male2 should have 1 vote
      const male2Ranking = ranking.male.find(u => u.userId === male2.id);
      expect(male2Ranking).toBeDefined();
      expect(male2Ranking.voteCount).toBe(1);

      // Verify female ranking
      expect(ranking.female).toHaveLength(3);
      
      // female1 should be first with 3 votes (2 tracked + 1 anonymous)
      const female1Ranking = ranking.female.find(u => u.userId === female1.id);
      expect(female1Ranking).toBeDefined();
      expect(female1Ranking.voteCount).toBe(3);
      expect(female1Ranking.rank).toBe(1);
      
      // female2 should have 1 vote
      const female2Ranking = ranking.female.find(u => u.userId === female2.id);
      expect(female2Ranking).toBeDefined();
      expect(female2Ranking.voteCount).toBe(1);

      // Verify recent votes include all voting methods
      const recentVotes = await getRecentVotes(10);
      expect(recentVotes).toHaveLength(8);
      
      // Check that votes from both methods are included
      const qrCodeVotes = recentVotes.filter(v => v.voterId && v.ipAddress);
      const userListVotes = recentVotes.filter(v => v.voterId);
      const anonymousVotes = recentVotes.filter(v => !v.voterId);
      
      expect(qrCodeVotes.length).toBeGreaterThan(0);
      expect(userListVotes.length).toBeGreaterThan(0);
      expect(anonymousVotes).toHaveLength(2);

      // Verify voting progress includes mixed voting data
      const progress = await getVotingProgress();
      expect(progress.activeVoters).toBe(2); // voter1 and voter3 used atomicVote with restrictions
      expect(progress.maleVotesCast).toBe(2);
      expect(progress.femaleVotesCast).toBe(1); // Only voter1 completed both genders via atomicVote
    });

    test('should maintain data consistency when switching between voting methods', async () => {
      // Create test participants
      const male1 = await createUser({ name: '参与者A', gender: 'male' });
      const female1 = await createUser({ name: '参与者B', gender: 'female' });
      
      // Create voter
      const voter = await createUser({ name: '测试投票者', gender: 'male' });

      // Start with QR code voting (atomicVote)
      const qrVoteResult = await atomicVote({
        voterId: voter.id,
        targetUserId: male1.id,
        targetGender: 'male',
        ipAddress: '192.168.1.100'
      });
      
      expect(qrVoteResult.success).toBe(true);

      // Get initial statistics
      const initialStats = await getVoteStatistics();
      expect(initialStats.totalVotes).toBe(1);
      expect(initialStats.maleVotes).toBe(1);

      // Switch to user list voting (recordVote) for the same voter
      await recordVote({
        voterId: voter.id,
        targetUserId: female1.id,
        ipAddress: '192.168.1.100'
      });

      // Get updated statistics
      const updatedStats = await getVoteStatistics();
      expect(updatedStats.totalVotes).toBe(2);
      expect(updatedStats.maleVotes).toBe(1);
      expect(updatedStats.femaleVotes).toBe(1);

      // Verify ranking consistency
      const ranking = await getRanking();
      
      const male1Ranking = ranking.male.find(u => u.userId === male1.id);
      expect(male1Ranking.voteCount).toBe(1);
      
      const female1Ranking = ranking.female.find(u => u.userId === female1.id);
      expect(female1Ranking.voteCount).toBe(1);

      // Add more votes using different methods
      await recordVote({ targetUserId: male1.id }); // Anonymous vote
      await atomicVote({
        voterId: 'another-voter',
        targetUserId: female1.id,
        targetGender: 'female'
      });

      // Final verification
      const finalStats = await getVoteStatistics();
      expect(finalStats.totalVotes).toBe(4);
      
      const finalRanking = await getRanking();
      const finalMale1 = finalRanking.male.find(u => u.userId === male1.id);
      const finalFemale1 = finalRanking.female.find(u => u.userId === female1.id);
      
      expect(finalMale1.voteCount).toBe(2);
      expect(finalFemale1.voteCount).toBe(2);
    });

    test('should handle concurrent mixed voting correctly', async () => {
      // Create test data
      const participants = [];
      for (let i = 1; i <= 4; i++) {
        participants.push(await createUser({
          name: `参与者${i}`,
          gender: i % 2 === 1 ? 'male' : 'female'
        }));
      }

      const voters = [];
      for (let i = 1; i <= 3; i++) {
        voters.push(await createUser({
          name: `投票者${i}`,
          gender: i % 2 === 1 ? 'male' : 'female'
        }));
      }

      // Simulate concurrent voting using different methods
      const votePromises = [];
      
      // QR code votes
      votePromises.push(atomicVote({
        voterId: voters[0].id,
        targetUserId: participants[0].id,
        targetGender: participants[0].gender
      }));
      
      votePromises.push(atomicVote({
        voterId: voters[1].id,
        targetUserId: participants[1].id,
        targetGender: participants[1].gender
      }));

      // User list votes
      votePromises.push(recordVote({
        voterId: voters[2].id,
        targetUserId: participants[0].id
      }));
      
      votePromises.push(recordVote({
        voterId: voters[0].id,
        targetUserId: participants[1].id
      }));

      // Anonymous votes
      votePromises.push(recordVote({
        targetUserId: participants[2].id
      }));
      
      votePromises.push(recordVote({
        targetUserId: participants[3].id
      }));

      // Execute all votes concurrently
      const results = await Promise.allSettled(votePromises);
      
      // Count successful votes
      const successfulVotes = results.filter(r => 
        r.status === 'fulfilled' && 
        (r.value.success === true || r.value.id !== undefined)
      ).length;

      expect(successfulVotes).toBeGreaterThan(0);

      // Verify final statistics are consistent
      const finalStats = await getVoteStatistics();
      const finalRanking = await getRanking();
      
      // Total votes should match successful operations
      expect(finalStats.totalVotes).toBe(successfulVotes);
      
      // Ranking should reflect all votes
      const totalRankingVotes = finalRanking.male.reduce((sum, u) => sum + u.voteCount, 0) +
                               finalRanking.female.reduce((sum, u) => sum + u.voteCount, 0);
      
      expect(totalRankingVotes).toBe(finalStats.totalVotes);
    });

    test('should provide accurate real-time statistics updates', async () => {
      // Create test participants
      const male1 = await createUser({ name: '实时测试男', gender: 'male' });
      const female1 = await createUser({ name: '实时测试女', gender: 'female' });
      const voter1 = await createUser({ name: '实时投票者', gender: 'male' });

      // Initial state
      let stats = await getVoteStatistics();
      expect(stats.totalVotes).toBe(0);

      // Add QR code vote
      await atomicVote({
        voterId: voter1.id,
        targetUserId: male1.id,
        targetGender: 'male'
      });

      stats = await getVoteStatistics();
      expect(stats.totalVotes).toBe(1);
      expect(stats.maleVotes).toBe(1);

      // Add user list vote
      await recordVote({
        voterId: voter1.id,
        targetUserId: female1.id
      });

      stats = await getVoteStatistics();
      expect(stats.totalVotes).toBe(2);
      expect(stats.femaleVotes).toBe(1);

      // Add anonymous vote
      await recordVote({
        targetUserId: male1.id
      });

      stats = await getVoteStatistics();
      expect(stats.totalVotes).toBe(3);
      expect(stats.maleVotes).toBe(2);

      // Verify ranking updates in real-time
      const ranking = await getRanking();
      const male1Ranking = ranking.male.find(u => u.userId === male1.id);
      const female1Ranking = ranking.female.find(u => u.userId === female1.id);

      expect(male1Ranking.voteCount).toBe(2);
      expect(female1Ranking.voteCount).toBe(1);
    });
  });
});