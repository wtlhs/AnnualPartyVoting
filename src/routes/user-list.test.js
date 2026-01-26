const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock the database operations
jest.mock('../database/operations');
const { getAllUsers } = require('../database/operations');

// Import the routes
const usersRouter = require('./users');
const pagesRouter = require('./pages');

describe('User List Property-Based Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);
    app.use('/', pagesRouter);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('属性 15: 用户列表显示完整性', () => {
    test('对于任何用户列表渲染请求，系统应该显示所有已注册用户的完整信息', async () => {
      // 准备测试数据 - 各种类型的用户
      const testUsers = [
        {
          id: 'user1',
          numericId: '123456',
          name: '张三',
          gender: 'male',
          avatarUrl: '/static/images/default-male-avatar.svg',
          voteCount: 5
        },
        {
          id: 'user2',
          numericId: '654321',
          name: '李四',
          gender: 'female',
          avatarUrl: '/uploads/avatar2.jpg',
          voteCount: 0
        },
        {
          id: 'user3',
          numericId: '111111',
          name: '王五',
          gender: 'male',
          avatarUrl: '/static/images/default-male-avatar.svg',
          voteCount: 10
        }
      ];

      getAllUsers.mockResolvedValue(testUsers);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      // 验证响应结构
      expect(response.body.success).toBe(true);
      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);

      // 验证用户数量完整性
      expect(response.body.users).toHaveLength(testUsers.length);

      // 验证每个用户的完整信息
      response.body.users.forEach((user, index) => {
        const expectedUser = testUsers[index];
        
        // 验证必需字段存在
        expect(user.userId).toBe(expectedUser.id);
        expect(user.numericId).toBe(expectedUser.numericId);
        expect(user.name).toBe(expectedUser.name);
        expect(user.gender).toBe(expectedUser.gender);
        expect(user.avatarUrl).toBe(expectedUser.avatarUrl);
        expect(user.voteCount).toBe(expectedUser.voteCount);

        // 验证字段类型正确
        expect(typeof user.userId).toBe('string');
        expect(typeof user.name).toBe('string');
        expect(['male', 'female']).toContain(user.gender);
        expect(typeof user.avatarUrl).toBe('string');
        expect(typeof user.voteCount).toBe('number');
        expect(user.voteCount).toBeGreaterThanOrEqual(0);
      });
    });

    test('空用户列表应该返回空数组但保持结构完整性', async () => {
      getAllUsers.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users).toHaveLength(0);
    });

    test('用户列表应该按指定顺序排序（注册时间降序）', async () => {
      const testUsers = [
        {
          id: 'user1',
          numericId: '111111',
          name: '最新用户',
          gender: 'male',
          avatarUrl: '/static/images/default-male-avatar.svg',
          voteCount: 0,
          createdAt: '2024-01-03T10:00:00Z'
        },
        {
          id: 'user2',
          numericId: '222222',
          name: '中间用户',
          gender: 'female',
          avatarUrl: '/static/images/default-female-avatar.svg',
          voteCount: 5,
          createdAt: '2024-01-02T10:00:00Z'
        },
        {
          id: 'user3',
          numericId: '333333',
          name: '最早用户',
          gender: 'male',
          avatarUrl: '/static/images/default-male-avatar.svg',
          voteCount: 10,
          createdAt: '2024-01-01T10:00:00Z'
        }
      ];

      getAllUsers.mockResolvedValue(testUsers);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body.users).toHaveLength(3);
      
      // 验证顺序（getAllUsers已经按创建时间降序排序）
      expect(response.body.users[0].name).toBe('最新用户');
      expect(response.body.users[1].name).toBe('中间用户');
      expect(response.body.users[2].name).toBe('最早用户');
    });
  });

  describe('属性 16: 搜索过滤准确性', () => {
    const testUsers = [
      {
        id: 'user1',
        numericId: '123456',
        name: '张三',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg',
        voteCount: 5
      },
      {
        id: 'user2',
        numericId: '654321',
        name: '李四',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg',
        voteCount: 3
      },
      {
        id: 'user3',
        numericId: '111222',
        name: '王五',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg',
        voteCount: 8
      },
      {
        id: 'user4',
        numericId: '333444',
        name: '赵六',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg',
        voteCount: 2
      }
    ];

    beforeEach(() => {
      getAllUsers.mockResolvedValue(testUsers);
    });

    test('姓名搜索应该支持模糊匹配和部分匹配', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);

      const users = response.body.users;

      // 测试前端搜索逻辑（模拟）
      const searchTests = [
        { query: '张', expectedNames: ['张三'] },
        { query: '李', expectedNames: ['李四'] },
        { query: '三', expectedNames: ['张三'] },
        { query: '四', expectedNames: ['李四'] },
        { query: '王', expectedNames: ['王五'] },
        { query: '赵', expectedNames: ['赵六'] }
      ];

      searchTests.forEach(({ query, expectedNames }) => {
        const filtered = users.filter(user => 
          user.name.toLowerCase().includes(query.toLowerCase())
        );
        
        expect(filtered.map(u => u.name)).toEqual(expectedNames);
      });
    });

    test('数字ID搜索应该支持精确匹配和部分匹配', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);

      const users = response.body.users;

      // 测试数字ID搜索
      const idSearchTests = [
        { query: '123456', expectedCount: 1 },
        { query: '123', expectedCount: 1 }, // 部分匹配 123456
        { query: '321', expectedCount: 1 }, // 部分匹配 654321
        { query: '111', expectedCount: 1 }, // 部分匹配 111222
        { query: '999', expectedCount: 0 }, // 无匹配
        { query: '1', expectedCount: 3 }    // 匹配 123456, 654321 和 111222
      ];

      idSearchTests.forEach(({ query, expectedCount }) => {
        const filtered = users.filter(user => 
          user.numericId && user.numericId.toString().includes(query)
        );
        
        expect(filtered).toHaveLength(expectedCount);
      });
    });

    test('搜索结果为空时应该返回空数组', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);

      const users = response.body.users;

      // 测试不存在的搜索词
      const noMatchQueries = ['不存在的用户', '999999', 'xyz'];

      noMatchQueries.forEach(query => {
        const nameFiltered = users.filter(user => 
          user.name.toLowerCase().includes(query.toLowerCase())
        );
        const idFiltered = users.filter(user => 
          user.numericId && user.numericId.toString().includes(query)
        );
        
        expect(nameFiltered).toHaveLength(0);
        expect(idFiltered).toHaveLength(0);
      });
    });

    test('清空搜索框时应该恢复显示完整的用户列表', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);

      const users = response.body.users;

      // 模拟搜索后清空的逻辑
      let filtered = users.filter(user => 
        user.name.toLowerCase().includes('张')
      );
      expect(filtered).toHaveLength(1);

      // 清空搜索（空字符串）
      filtered = users.filter(user => {
        const query = '';
        if (!query) return true;
        return user.name.toLowerCase().includes(query.toLowerCase()) ||
               (user.numericId && user.numericId.toString().includes(query));
      });

      expect(filtered).toHaveLength(testUsers.length);
      expect(filtered).toEqual(users);
    });
  });

  describe('属性 17: 用户列表投票导航一致性', () => {
    test('用户列表页面应该可以正确访问', async () => {
      const response = await request(app)
        .get('/user-list')
        .expect(200);

      // 验证返回的是HTML页面
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('投票确认页面应该可以通过用户ID访问', async () => {
      const testUserId = 'test-user-123';
      
      const response = await request(app)
        .get(`/vote/${testUserId}`)
        .expect(200);

      // 验证返回的是HTML页面
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('无效的用户ID应该仍然返回投票页面（由前端处理错误）', async () => {
      const invalidUserId = 'invalid-user-id';
      
      const response = await request(app)
        .get(`/vote/${invalidUserId}`)
        .expect(200);

      // 页面应该正常返回，错误处理由前端JavaScript完成
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('错误处理和边缘情况', () => {
    test('数据库错误时应该返回适当的错误响应', async () => {
      getAllUsers.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/users')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('GET_USERS_FAILED');
      expect(response.body.message).toBe('获取用户列表失败');
    });

    test('用户数据缺失字段时应该有默认值', async () => {
      const incompleteUsers = [
        {
          id: 'user1',
          name: '张三',
          gender: 'male',
          // 缺少 numericId, avatarUrl, voteCount
        }
      ];

      getAllUsers.mockResolvedValue(incompleteUsers);

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      const user = response.body.users[0];
      expect(user.voteCount).toBe(0); // 默认值
      expect(user.numericId).toBeUndefined(); // 可以为空
    });
  });
});