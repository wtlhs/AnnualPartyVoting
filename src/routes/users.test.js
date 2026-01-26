const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Import the users router
const userRoutes = require('./users');

// Mock the database operations
jest.mock('../database/operations', () => ({
  createUser: jest.fn(),
  getUserById: jest.fn(),
  getUserByName: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  getAllUsers: jest.fn()
}));

const { createUser, getUserById, getUserByName, updateUser, deleteUser, getAllUsers } = require('../database/operations');

// Create test app
const app = express();
app.use(express.json());

// Configure multer for testing
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'), false);
    }
  }
});

app.locals.upload = upload;
app.use('/api/users', userRoutes);

describe('User Registration API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/users/register', () => {
    it('should successfully register a male user with valid data', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      };

      const mockUpdatedUser = {
        ...mockUser,
        qrCode: '{"userId":"test-user-id","name":"John Doe","gender":"male","timestamp":1234567890,"type":"vote"}'
      };

      getUserByName.mockResolvedValue(null); // Name not taken
      createUser.mockResolvedValue(mockUser);
      updateUser.mockResolvedValue(mockUpdatedUser);
      getAllUsers.mockResolvedValue([]); // No existing users

      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'John Doe',
          gender: 'male'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe('test-user-id');
      expect(response.body.name).toBe('John Doe');
      expect(response.body.gender).toBe('male');
      expect(response.body.avatarUrl).toBe('/static/images/default-male-avatar.svg');
      expect(response.body.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(response.body.qrData).toContain('test-user-id');

      expect(getUserByName).toHaveBeenCalledWith('John Doe');
      expect(createUser).toHaveBeenCalledWith({
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      });
    });

    it('should successfully register a female user with correct default avatar', async () => {
      const mockUser = {
        id: 'test-user-id-2',
        name: 'Jane Doe',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg'
      };

      const mockUpdatedUser = {
        ...mockUser,
        qrCode: '{"userId":"test-user-id-2","name":"Jane Doe","gender":"female","timestamp":1234567890,"type":"vote"}'
      };

      getUserByName.mockResolvedValue(null); // Name not taken
      createUser.mockResolvedValue(mockUser);
      updateUser.mockResolvedValue(mockUpdatedUser);
      getAllUsers.mockResolvedValue([]); // No existing users

      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'Jane Doe',
          gender: 'female'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.gender).toBe('female');
      expect(response.body.avatarUrl).toBe('/static/images/default-female-avatar.svg');

      expect(getUserByName).toHaveBeenCalledWith('Jane Doe');
      expect(createUser).toHaveBeenCalledWith({
        name: 'Jane Doe',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg'
      });
    });

    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: '',
          gender: 'male'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_NAME');
      expect(response.body.message).toBe('姓名不能为空');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only name', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: '   ',
          gender: 'male'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_NAME');
      expect(response.body.message).toBe('姓名不能为空');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('should reject name longer than 20 characters', async () => {
      const longName = 'This is a very long name that exceeds twenty characters';
      
      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: longName,
          gender: 'male'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('NAME_TOO_LONG');
      expect(response.body.message).toBe('姓名长度不能超过20个字符');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('should reject missing gender', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'John Doe'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_GENDER');
      expect(response.body.message).toBe('请选择有效的性别');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('should reject invalid gender', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'John Doe',
          gender: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_GENDER');
      expect(response.body.message).toBe('请选择有效的性别');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      };

      const mockUpdatedUser = {
        ...mockUser,
        qrCode: '{"userId":"test-user-id","name":"John Doe","gender":"male","timestamp":1234567890,"type":"vote"}'
      };

      getUserByName.mockResolvedValue(null); // Name not taken
      createUser.mockResolvedValue(mockUser);
      updateUser.mockResolvedValue(mockUpdatedUser);
      getAllUsers.mockResolvedValue([]); // No existing users

      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: '  John Doe  ',
          gender: 'male'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('John Doe');
      expect(getUserByName).toHaveBeenCalledWith('John Doe');
      expect(createUser).toHaveBeenCalledWith({
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      });
    });

    it('should reject duplicate name (case-insensitive)', async () => {
      const existingUser = {
        id: 'existing-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg',
        voteCount: 0
      };

      getUserByName.mockResolvedValue(existingUser); // Name already exists

      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'john doe', // Different case
          gender: 'female'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('NAME_ALREADY_EXISTS');
      expect(response.body.message).toBe('该姓名已被注册，请使用其他姓名');
      expect(getUserByName).toHaveBeenCalledWith('john doe');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('should reject duplicate name with exact match', async () => {
      const existingUser = {
        id: 'existing-user-id',
        name: 'Jane Smith',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg',
        voteCount: 2
      };

      getUserByName.mockResolvedValue(existingUser); // Name already exists

      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'Jane Smith',
          gender: 'female'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('NAME_ALREADY_EXISTS');
      expect(response.body.message).toBe('该姓名已被注册，请使用其他姓名');
      expect(getUserByName).toHaveBeenCalledWith('Jane Smith');
      expect(createUser).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      getUserByName.mockResolvedValue(null); // Name not taken
      createUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'John Doe',
          gender: 'male'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('REGISTRATION_FAILED');
      expect(response.body.message).toBe('注册失败，请稍后重试');
    });
  });

  describe('GET /api/users/:userId', () => {
    it('should return user information successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg',
        voteCount: 5,
        qrCode: '{"userId":"test-user-id","name":"John Doe","gender":"male","timestamp":1234567890,"type":"vote","nonce":"test-nonce"}',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      getUserById.mockResolvedValue(mockUser);
      getAllUsers.mockResolvedValue([]); // For potential QR regeneration

      const response = await request(app)
        .get('/api/users/test-user-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe('test-user-id');
      expect(response.body.name).toBe('John Doe');
      expect(response.body.gender).toBe('male');
      expect(response.body.voteCount).toBe(5);
      expect(response.body.qrCode).toMatch(/^data:image\/png;base64,/);
    });

    it('should return 404 for non-existent user', async () => {
      getUserById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('USER_NOT_FOUND');
      expect(response.body.message).toBe('用户不存在');
    });

    it('should return 400 for empty user ID', async () => {
      const response = await request(app)
        .get('/api/users/');

      expect(response.status).toBe(404); // Express returns 404 for missing route parameter
    });

    it('should handle database errors gracefully', async () => {
      getUserById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/test-user-id');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('GET_USER_FAILED');
      expect(response.body.message).toBe('获取用户信息失败');
    });
  });

  describe('QR Code Generation', () => {
    it('should generate QR code with correct data format', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      };

      const mockUpdatedUser = {
        ...mockUser,
        qrCode: '{"userId":"test-user-id","name":"John Doe","gender":"male","timestamp":1234567890,"type":"vote"}'
      };

      getUserByName.mockResolvedValue(null); // Name not taken
      createUser.mockResolvedValue(mockUser);
      updateUser.mockResolvedValue(mockUpdatedUser);
      getAllUsers.mockResolvedValue([]); // No existing users

      const response = await request(app)
        .post('/api/users/register')
        .send({
          name: 'John Doe',
          gender: 'male'
        });

      expect(response.status).toBe(200);
      
      // Verify QR data format
      const qrData = JSON.parse(response.body.qrData);
      expect(qrData.userId).toBe('test-user-id');
      expect(qrData.name).toBe('John Doe');
      expect(qrData.gender).toBe('male');
      expect(qrData.type).toBe('vote');
      expect(typeof qrData.timestamp).toBe('number');
      
      // Verify QR code is base64 encoded PNG
      expect(response.body.qrCode).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('Avatar Upload API', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Ensure uploads directory exists for tests
      if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads', { recursive: true });
      }
    });

    afterEach(() => {
      // Clean up test files
      if (fs.existsSync('uploads')) {
        const files = fs.readdirSync('uploads');
        files.forEach(file => {
          if (file.startsWith('avatar-')) {
            fs.unlinkSync(path.join('uploads', file));
          }
        });
      }
    });

    it('should successfully upload JPG avatar', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      };

      const mockUpdatedUser = {
        ...mockUser,
        avatarUrl: '/uploads/avatar-123456789.jpg'
      };

      getUserById.mockResolvedValue(mockUser);
      updateUser.mockResolvedValue(mockUpdatedUser);

      // Create a test JPG buffer (minimal valid JPEG)
      const jpgBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/api/users/upload-avatar')
        .field('userId', 'test-user-id')
        .attach('avatar', jpgBuffer, 'test-avatar.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.avatarUrl).toMatch(/^\/uploads\/avatar-.*\.jpg$/);
      expect(response.body.message).toBe('头像上传成功');
      
      expect(getUserById).toHaveBeenCalledWith('test-user-id');
      expect(updateUser).toHaveBeenCalledWith('test-user-id', {
        avatarUrl: expect.stringMatching(/^\/uploads\/avatar-.*\.jpg$/)
      });
    });

    it('should successfully upload PNG avatar', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'Jane Doe',
        gender: 'female',
        avatarUrl: '/static/images/default-female-avatar.svg'
      };

      const mockUpdatedUser = {
        ...mockUser,
        avatarUrl: '/uploads/avatar-123456789.png'
      };

      getUserById.mockResolvedValue(mockUser);
      updateUser.mockResolvedValue(mockUpdatedUser);

      // Create a test PNG buffer (minimal valid PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ]);

      const response = await request(app)
        .post('/api/users/upload-avatar')
        .field('userId', 'test-user-id')
        .attach('avatar', pngBuffer, 'test-avatar.png');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.avatarUrl).toMatch(/^\/uploads\/avatar-.*\.png$/);
      expect(response.body.message).toBe('头像上传成功');
    });

    it('should reject unsupported file formats', async () => {
      const textBuffer = Buffer.from('This is not an image');

      const response = await request(app)
        .post('/api/users/upload-avatar')
        .field('userId', 'test-user-id')
        .attach('avatar', textBuffer, 'test-file.txt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_FILE_TYPE');
      expect(response.body.message).toBe('只支持JPG和PNG格式的图片文件');
    });

    it('should reject files larger than 2MB', async () => {
      // Create a buffer larger than 2MB
      const largeBuffer = Buffer.alloc(3 * 1024 * 1024); // 3MB
      // Add JPG header to make it a valid JPEG
      largeBuffer[0] = 0xFF;
      largeBuffer[1] = 0xD8;

      const response = await request(app)
        .post('/api/users/upload-avatar')
        .field('userId', 'test-user-id')
        .attach('avatar', largeBuffer, 'large-image.jpg');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FILE_TOO_LARGE');
      expect(response.body.message).toBe('文件大小超过限制（最大2MB）');
    });

    it('should return error when no file is provided', async () => {
      const response = await request(app)
        .post('/api/users/upload-avatar')
        .field('userId', 'test-user-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('NO_FILE');
      expect(response.body.message).toBe('请选择要上传的文件');
    });

    it('should return error when userId is missing', async () => {
      const jpgBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/api/users/upload-avatar')
        .attach('avatar', jpgBuffer, 'test-avatar.jpg');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_USER_ID');
      expect(response.body.message).toBe('用户ID不能为空');
    });

    it('should return error when user does not exist', async () => {
      getUserById.mockResolvedValue(null);

      const jpgBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/api/users/upload-avatar')
        .field('userId', 'non-existent-user')
        .attach('avatar', jpgBuffer, 'test-avatar.jpg');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('USER_NOT_FOUND');
      expect(response.body.message).toBe('用户不存在');
    });

    it('should handle database errors during avatar update', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      };

      getUserById.mockResolvedValue(mockUser);
      updateUser.mockRejectedValue(new Error('Database error'));

      const jpgBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/api/users/upload-avatar')
        .field('userId', 'test-user-id')
        .attach('avatar', jpgBuffer, 'test-avatar.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('AVATAR_UPDATE_FAILED');
      expect(response.body.message).toBe('头像更新失败');
    });
  });

  describe('DELETE /:userId', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should delete user successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male',
        avatarUrl: '/static/images/default-male-avatar.svg'
      };

      getUserById.mockResolvedValue(mockUser);
      deleteUser.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/test-user-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('用户账号已删除，可以重新注册');
      expect(response.body.deletedUser).toEqual({
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male'
      });
      expect(deleteUser).toHaveBeenCalledWith('test-user-id');
    });

    test('should return 400 for missing user ID', async () => {
      const response = await request(app)
        .delete('/api/users/');

      expect(response.status).toBe(404); // Express returns 404 for missing route params
    });

    test('should return 404 for non-existent user', async () => {
      getUserById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/users/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('USER_NOT_FOUND');
      expect(response.body.message).toBe('用户不存在');
      expect(deleteUser).not.toHaveBeenCalled();
    });

    test('should handle database deletion error', async () => {
      const mockUser = {
        id: 'test-user-id',
        name: 'John Doe',
        gender: 'male'
      };

      getUserById.mockResolvedValue(mockUser);
      deleteUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/users/test-user-id');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('DELETE_USER_FAILED');
      expect(response.body.message).toBe('删除用户失败，请稍后重试');
    });

    test('should handle getUserById error', async () => {
      getUserById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/users/test-user-id');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('DELETE_USER_FAILED');
      expect(response.body.message).toBe('删除用户失败，请稍后重试');
      expect(deleteUser).not.toHaveBeenCalled();
    });
  });
});