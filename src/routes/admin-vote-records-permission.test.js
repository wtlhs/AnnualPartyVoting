/**
 * 投票记录管理权限控制测试
 * 验证所有管理接口都有正确的权限验证
 */

const request = require('supertest');
const express = require('express');
const adminRoutes = require('./admin');
const pageRoutes = require('./pages');

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use('/', pageRoutes);

describe('投票记录管理权限控制', () => {
  
  describe('API接口权限验证', () => {
    const protectedRoutes = [
      { method: 'GET', path: '/api/admin/vote-records' },
      { method: 'GET', path: '/api/admin/vote-records/1' },
      { method: 'PUT', path: '/api/admin/vote-records/1/status' },
      { method: 'PUT', path: '/api/admin/vote-records/batch-status' },
      { method: 'GET', path: '/api/admin/vote-records/1/history' },
      { method: 'POST', path: '/api/admin/export/vote-records' },
      { method: 'GET', path: '/api/admin/export/1/download' },
      { method: 'GET', path: '/api/admin/dashboard' },
      { method: 'GET', path: '/api/admin/users' },
      { method: 'POST', path: '/api/admin/clear-data' },
      { method: 'GET', path: '/api/admin/backup' },
      { method: 'POST', path: '/api/admin/archive-and-clear' }
    ];

    protectedRoutes.forEach(({ method, path }) => {
      test(`${method} ${path} 应该要求认证`, async () => {
        const response = await request(app)[method.toLowerCase()](path);
        
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.requiresAuth).toBe(true);
        expect(response.body.errorCode).toMatch(/UNAUTHORIZED|AUTH_FAILED|SESSION_NOT_FOUND|SESSION_EXPIRED/);
      });

      test(`${method} ${path} 应该拒绝无效token`, async () => {
        const response = await request(app)
          [method.toLowerCase()](path)
          .set('Authorization', 'Bearer invalid_token');
        
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.requiresAuth).toBe(true);
      });

      test(`${method} ${path} 应该拒绝格式错误的Authorization头`, async () => {
        const response = await request(app)
          [method.toLowerCase()](path)
          .set('Authorization', 'invalid_format');
        
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.requiresAuth).toBe(true);
      });
    });
  });

  describe('页面路由权限验证', () => {
    test('GET /vote-records 应该要求认证', async () => {
      const response = await request(app).get('/vote-records');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });

    test('GET /vote-records 应该拒绝无效token', async () => {
      const response = await request(app)
        .get('/vote-records')
        .set('Authorization', 'Bearer invalid_token');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });

    test('GET /admin 应该允许未认证访问（登录页面）', async () => {
      const response = await request(app).get('/admin');
      
      // 登录页面应该可以访问，返回HTML文件
      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
    });
  });

  describe('权限验证中间件功能', () => {
    test('应该正确识别Bearer token格式', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Basic invalid');
      
      expect(response.status).toBe(401);
      expect(response.body.errorCode).toBe('UNAUTHORIZED');
      expect(response.body.message).toBe('需要管理员权限');
    });

    test('应该正确处理缺失的Authorization头', async () => {
      const response = await request(app).get('/api/admin/dashboard');
      
      expect(response.status).toBe(401);
      expect(response.body.errorCode).toBe('UNAUTHORIZED');
      expect(response.body.message).toBe('需要管理员权限');
    });

    test('应该在响应中包含requiresAuth标志', async () => {
      const response = await request(app).get('/api/admin/vote-records');
      
      expect(response.body.requiresAuth).toBe(true);
    });
  });

  describe('批量操作权限验证', () => {
    test('批量状态更新应该要求认证', async () => {
      const response = await request(app)
        .put('/api/admin/vote-records/batch-status')
        .send({
          voteIds: [1, 2, 3],
          status: 'inactive',
          reason: '测试'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });
  });

  describe('导出功能权限验证', () => {
    test('创建导出任务应该要求认证', async () => {
      const response = await request(app)
        .post('/api/admin/export/vote-records')
        .send({
          format: 'csv',
          filters: {},
          columns: ['voter_name', 'candidate_name']
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });

    test('下载导出文件应该要求认证', async () => {
      const response = await request(app).get('/api/admin/export/1/download');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });
  });

  describe('会话管理权限验证', () => {
    test('获取会话信息应该要求认证', async () => {
      const response = await request(app).get('/api/admin/session');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });

    test('登出应该要求认证', async () => {
      const response = await request(app).post('/api/admin/logout');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });
  });

  describe('数据管理权限验证', () => {
    test('清空数据应该要求认证', async () => {
      const response = await request(app).post('/api/admin/clear-data');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });

    test('创建备份应该要求认证', async () => {
      const response = await request(app).get('/api/admin/backup');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });

    test('归档和清空应该要求认证', async () => {
      const response = await request(app)
        .post('/api/admin/archive-and-clear')
        .send({ includeFiles: true });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresAuth).toBe(true);
    });
  });
});

describe('权限控制属性测试', () => {
  /**
   * 属性 11: 权限验证正确性
   * 验证需求: 需求 7.1, 7.2
   */
  test('**Feature: admin-vote-records, Property 11: 权限验证正确性** - 只有具有管理员权限的用户应能访问投票记录管理功能', async () => {
    const protectedEndpoints = [
      '/api/admin/vote-records',
      '/api/admin/vote-records/1',
      '/api/admin/export/vote-records',
      '/vote-records'
    ];

    for (const endpoint of protectedEndpoints) {
      // 测试未认证访问
      const unauthResponse = await request(app).get(endpoint);
      expect(unauthResponse.status).toBe(401);
      expect(unauthResponse.body.requiresAuth).toBe(true);

      // 测试无效token访问
      const invalidTokenResponse = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer invalid_token');
      expect(invalidTokenResponse.status).toBe(401);
      expect(invalidTokenResponse.body.requiresAuth).toBe(true);
    }
  });
});