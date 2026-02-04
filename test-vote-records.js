const VoteRecordManager = require('./src/database/VoteRecordManager');

async function testVoteRecords() {
  console.log('🧪 测试投票记录查询...\n');

  const voteRecordManager = new VoteRecordManager();

  try {
    // 测试不带任何筛选条件的查询
    console.log('📋 测试1: 查询所有投票记录');
    const result1 = await voteRecordManager.getVoteRecords({}, {});
    console.log('  查询结果:', JSON.stringify(result1, null, 2));
    console.log(`  返回记录数: ${result1.records.length}`);
    console.log(`  总记录数: ${result1.pagination.total}`);
    console.log();

    // 测试带分页的查询
    console.log('📋 测试2: 分页查询 (page=1, limit=10)');
    const result2 = await voteRecordManager.getVoteRecords({}, { page: 1, limit: 10 });
    console.log(`  返回记录数: ${result2.records.length}`);
    console.log(`  总记录数: ${result2.pagination.total}`);
    console.log();

    // 测试带状态筛选的查询
    console.log('📋 测试3: 筛选 active 状态的记录');
    const result3 = await voteRecordManager.getVoteRecords({ status: 'active' }, {});
    console.log(`  返回记录数: ${result3.records.length}`);
    console.log(`  总记录数: ${result3.pagination.total}`);
    console.log();

    // 测试按 created_at 排序
    console.log('📋 测试4: 按 created_at DESC 排序');
    const result4 = await voteRecordManager.getVoteRecords({}, { sortBy: 'created_at', sortOrder: 'DESC' });
    console.log(`  返回记录数: ${result4.records.length}`);
    if (result4.records.length > 0) {
      console.log(`  第一条记录时间: ${result4.records[0].createdAt}`);
    }
    console.log();

    console.log('✅ 测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.stack);
  }
}

testVoteRecords();
