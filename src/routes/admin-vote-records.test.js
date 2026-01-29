/**
 * 投票记录管理API单元测试
 */

const request = require('supertest');
const express = require('express');
const adminRoutes = require('./admin');

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

// 模拟管理员认证
const ADMIN_TOKEN = process.env.ADMIN_PASSWORD || 'admin123';

describe('投票记录管理API', () => {
  
  describe('GET /api/admin/vote-records', () => {
    test('应该返回投票记录列表', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('records');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.records)).toBe(true);
    });
    
    test('应该支持分页参数', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records?page=1&limit=10')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);
      
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });
    
    test('应该支持状态筛选', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records?status=active')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('应该支持搜索功能', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records?search=test')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('未授权访问应该返回401', async () => {
      await request(app)
        .get('/api/admin/vote-records')
        .expect(401);
    });
  });
  
  describe('GET /api/admin/vote-records/:id', () => {
    test('无效ID应该返回400', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records/invalid')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_VOTE_ID');
    });
    
    test('不存在的记录应该返回404', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records/99999')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VOTE_RECORD_NOT_FOUND');
    });
  });
  
  describe('PUT /api/admin/vote-records/:id/status', () => {
    test('无效ID应该返回400', async () => {
      const response = await request(app)
        .put('/api/admin/vote-records/invalid/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'active', reason: '测试' })
        .expect(400);
      
      expect(response.body.errorCode).toBe('INVALID_VOTE_ID');
    });
    
    test('无效状态应该返回400', async () => {
      const response = await request(app)
        .put('/api/admin/vote-records/1/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'invalid_status', reason: '测试' })
        .expect(400);
      
      expect(response.body.errorCode).toBe('INVALID_STATUS');
    });
    
    test('缺少状态参数应该返回400', async () => {
      const response = await request(app)
        .put('/api/admin/vote-records/1/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ reason: '测试' })
        .expect(400);
      
      expect(response.body.errorCode).toBe('INVALID_STATUS');
    });
  });
  
  describe('PUT /api/admin/vote-records/batch-status', () => {
    test('空的ID数组应该返回400', async () => {
      const response = await request(app)
        .put('/api/admin/vote-records/batch-status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ voteIds: [], status: 'active', reason: '测试' })
        .expect(400);
      
      expect(response.body.errorCode).toBe('INVALID_VOTE_IDS');
    });
    
    test('无效的ID应该返回400', async () => {
      const response = await request(app)
        .put('/api/admin/vote-records/batch-status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ voteIds: ['invalid', 'ids'], status: 'active', reason: '测试' })
        .expect(400);
      
      expect(response.body.errorCode).toBe('INVALID_VOTE_IDS');
    });
    
    test('无效状态应该返回400', async () => {
      const response = await request(app)
        .put('/api/admin/vote-records/batch-status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ voteIds: [1, 2], status: 'invalid_status', reason: '测试' })
        .expect(400);
      
      expect(response.body.errorCode).toBe('INVALID_STATUS');
    });
  });
  
  describe('GET /api/admin/vote-records/:id/history', () => {
    test('无效ID应该返回400', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records/invalid/history')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(400);
      
      expect(response.body.errorCode).toBe('INVALID_VOTE_ID');
    });
    
    test('有效ID应该返回操作历史', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records/1/history')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('voteId');
      expect(response.body.data).toHaveProperty('history');
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });
    
    test('应该支持limit参数', async () => {
      const response = await request(app)
        .get('/api/admin/vote-records/1/history?limit=5')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
});