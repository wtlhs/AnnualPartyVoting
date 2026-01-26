const request = require('supertest');
const express = require('express');
const multer = require('multer');
const { initializeDatabase } = require('../database/init');
const { createUser } = require('../database/operations');
const { generateCompleteQRCode } = require('./qrcode');
const userRoutes = require('../routes/users');

// Create a test app without starting the server
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock multer for testing
  const upload = multer({ storage: multer.memoryStorage() });
  app.locals.upload = upload;
  
  app.use('/api/users', userRoutes);
  return app;
};

describe('QR Code Scanning Integration', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    app = createTestApp();
  });

  describe('QR Code Validation API', () => {
    let testUser;
    let validQRData;

    beforeEach(async () => {
      // Create a test user
      testUser = await createUser({
        name: '测试用户',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      });

      // Generate QR code for the user
      const { qrData } = await generateCompleteQRCode({
        userId: testUser.id,
        name: testUser.name,
        gender: testUser.gender
      });

      validQRData = qrData;

      // Update user with QR code
      const { updateUser } = require('../database/operations');
      await updateUser(testUser.id, { qrCode: qrData });
    });

    test('should validate correct QR code successfully', async () => {
      const response = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: validQRData })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        userId: testUser.id,
        numericId: testUser.numericId,
        name: testUser.name,
        gender: testUser.gender,
        avatarUrl: testUser.avatarUrl,
        voteCount: 0,
        message: '二维码验证成功'
      });
    });

    test('should reject empty QR data', async () => {
      const response = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: '' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        errorCode: 'MISSING_QR_DATA',
        message: '二维码数据不能为空'
      });
    });

    test('should reject invalid JSON format', async () => {
      const response = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: 'invalid json' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        errorCode: 'INVALID_QR_FORMAT',
        message: '二维码格式错误'
      });
    });

    test('should reject QR code with missing required fields', async () => {
      const invalidQR = JSON.stringify({
        userId: 'test-id',
        // Missing other required fields
      });

      const response = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: invalidQR })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        errorCode: 'INVALID_QR_FORMAT',
        message: '二维码格式错误'
      });
    });

    test('should reject QR code for non-existent user', async () => {
      const nonExistentUserQR = JSON.stringify({
        userId: 'non-existent-id',
        name: '不存在的用户',
        gender: 'male',
        timestamp: Date.now(),
        type: 'vote',
        nonce: 'test-nonce'
      });

      const response = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: nonExistentUserQR })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    });

    test('should reject QR code that does not match user record', async () => {
      // Create a different QR code for the same user
      const { qrData: differentQR } = await generateCompleteQRCode({
        userId: testUser.id,
        name: testUser.name,
        gender: testUser.gender
      });

      const response = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: differentQR })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        errorCode: 'INVALID_QR_CODE',
        message: '无效的二维码'
      });
    });

    test('should handle malformed QR data gracefully', async () => {
      const malformedQR = JSON.stringify({
        userId: testUser.id,
        name: testUser.name,
        gender: 'invalid-gender', // Invalid gender
        timestamp: Date.now(),
        type: 'vote',
        nonce: 'test-nonce'
      });

      const response = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: malformedQR })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        errorCode: 'INVALID_QR_FORMAT',
        message: '二维码格式错误'
      });
    });
  });

  describe('QR Code Scanning Flow', () => {
    test('should complete full scanning flow from QR generation to validation', async () => {
      // Step 1: Create a user directly (simulating registration)
      const testUser = await createUser({
        name: '扫码测试用户',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg'
      });

      // Generate QR code for the user
      const { qrData } = await generateCompleteQRCode({
        userId: testUser.id,
        name: testUser.name,
        gender: testUser.gender
      });

      // Update user with QR code
      const { updateUser } = require('../database/operations');
      await updateUser(testUser.id, { qrCode: qrData });

      // Step 2: Validate the generated QR code
      const validationResponse = await request(app)
        .post('/api/users/validate-qr')
        .send({ qrData: qrData })
        .expect(200);

      expect(validationResponse.body).toEqual({
        success: true,
        userId: testUser.id,
        numericId: testUser.numericId,
        name: '扫码测试用户',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg',
        voteCount: 0,
        message: '二维码验证成功'
      });
    });
  });
});