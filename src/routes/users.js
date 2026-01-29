const express = require('express');
const path = require('path');
const { createUser, getUserById, getUserByName, getUserByNumericId, updateUser, deleteUser, getAllUsers } = require('../database/operations');
const { generateCompleteQRCode, validateQRData, generateQRCodeImage, getServerBaseURL } = require('../utils/qrcode');

const router = express.Router();

// Default avatar URLs based on gender
const DEFAULT_AVATARS = {
  male: '/static/images/default-male-avatar.svg',
  female: '/static/images/default-female-avatar.svg'
};

/**
 * Helper function to ensure avatar URL is relative or uses correct host
 * @param {string} url - The avatar URL
 * @returns {string} Sanitized URL
 */
function sanitizeAvatarUrl(url) {
  if (!url) return null;
  
  // If it's a full URL containing localhost or other host info, make it relative
  try {
    if (url.startsWith('http')) {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname;
    }
  } catch (e) {
    // If URL parsing fails, return as is
  }
  
  return url;
}

// Get all users (public info only)
router.get('/', async (req, res) => {
  try {
    const users = await getAllUsers();
    
    // Return only necessary public info
    const publicUsers = users.map(user => ({
      userId: user.id,
      numericId: user.numericId,
      name: user.name,
      gender: user.gender,
      avatarUrl: sanitizeAvatarUrl(user.avatarUrl),
      voteCount: user.voteCount || 0
    }));
    
    res.json({
      success: true,
      users: publicUsers
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_USERS_FAILED',
      message: '获取用户列表失败'
    });
  }
});

// User registration endpoint
router.post('/register', async (req, res) => {
  try {
    const { name, gender, baseURL } = req.body;
    
    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_NAME',
        message: '姓名不能为空'
      });
    }
    
    if (name.trim().length > 20) {
      return res.status(400).json({
        success: false,
        errorCode: 'NAME_TOO_LONG',
        message: '姓名长度不能超过20个字符'
      });
    }
    
    if (!gender || !['male', 'female'].includes(gender)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_GENDER',
        message: '请选择有效的性别'
      });
    }
    
    // Validate baseURL if provided
    let validatedBaseURL = null;
    if (baseURL) {
      try {
        const url = new URL(baseURL);
        // Only allow http and https protocols
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          validatedBaseURL = `${url.protocol}//${url.host}`;
        }
      } catch (error) {
        console.warn('Invalid baseURL provided:', baseURL);
      }
    }
    
    // Check if name already exists (case-insensitive)
    const existingUser = await getUserByName(name.trim());
    if (existingUser) {
      return res.status(409).json({
        success: false,
        errorCode: 'NAME_ALREADY_EXISTS',
        message: '该姓名已被注册，请使用其他姓名'
      });
    }
    
    // Assign default avatar based on gender
    const avatarUrl = DEFAULT_AVATARS[gender];
    
    // Create user first to get the ID
    const user = await createUser({
      name: name.trim(),
      gender,
      avatarUrl
    });
    
    // Get existing QR codes to ensure uniqueness
    const allUsers = await getAllUsers();
    const existingQRCodes = allUsers
      .filter(u => u.qrCode && u.id !== user.id)
      .map(u => u.qrCode);
    
    // Temporarily set the base URL if provided by the client
    const originalBaseURL = process.env.SERVER_BASE_URL;
    if (validatedBaseURL) {
      process.env.SERVER_BASE_URL = validatedBaseURL;
    }
    
    try {
      // Generate unique QR code
      const { qrData, qrCodeImage } = await generateCompleteQRCode(
        {
          userId: user.id,
          name: user.name,
          gender: user.gender
        },
        existingQRCodes
      );
      
      // Update user with QR code data
      const updatedUser = await updateUser(user.id, {
        qrCode: qrData
      });
      
      res.json({
        success: true,
        userId: updatedUser.id,
        numericId: updatedUser.numericId,
        name: updatedUser.name,
        gender: updatedUser.gender,
        avatarUrl: sanitizeAvatarUrl(updatedUser.avatarUrl),
        qrCode: qrCodeImage,
        qrData: qrData,
        baseURL: validatedBaseURL || getServerBaseURL() // Return the base URL used
      });
    } finally {
      // Restore original base URL
      if (originalBaseURL) {
        process.env.SERVER_BASE_URL = originalBaseURL;
      } else if (validatedBaseURL) {
        delete process.env.SERVER_BASE_URL;
      }
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific QR code generation errors
    if (error.message.includes('Failed to generate unique QR code')) {
      return res.status(500).json({
        success: false,
        errorCode: 'QR_GENERATION_FAILED',
        message: '二维码生成失败，请重试'
      });
    }
    
    res.status(500).json({
      success: false,
      errorCode: 'REGISTRATION_FAILED',
      message: '注册失败，请稍后重试'
    });
  }
});

// Get user information
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_USER_ID',
        message: '用户ID不能为空'
      });
    }
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    }
    
    // Generate QR code if it doesn't exist
    let qrCodeBase64 = null;
    if (user.qrCode) {
      try {
        // Try to validate and generate QR code image
        // Handle both old JSON format and new URL format
        if (user.qrCode.startsWith('http')) {
          // New URL format - validate as URL
          validateQRData(user.qrCode);
          qrCodeBase64 = await generateQRCodeImage(user.qrCode);
        } else {
          // Old JSON format or invalid data - regenerate as URL
          throw new Error('Old format detected, regenerating...');
        }
      } catch (qrError) {
        console.error('QR code validation/generation error:', qrError);
        // If QR code is invalid or old format, regenerate it
        try {
          const allUsers = await getAllUsers();
          const existingQRCodes = allUsers
            .filter(u => u.qrCode && u.id !== user.id)
            .map(u => u.qrCode);
          
          const { qrData, qrCodeImage } = await generateCompleteQRCode(
            {
              userId: user.id,
              name: user.name,
              gender: user.gender
            },
            existingQRCodes
          );
          
          // Update user with new QR code
          await updateUser(user.id, { qrCode: qrData });
          qrCodeBase64 = qrCodeImage;
        } catch (regenerateError) {
          console.error('QR code regeneration error:', regenerateError);
        }
      }
    }
    
    res.json({
      success: true,
      userId: user.id,
      numericId: user.numericId,
      name: user.name,
      gender: user.gender,
      avatarUrl: sanitizeAvatarUrl(user.avatarUrl),
      voteCount: user.voteCount,
      qrCode: qrCodeBase64,
      qrData: user.qrCode,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'GET_USER_FAILED',
      message: '获取用户信息失败'
    });
  }
});

// Upload avatar
router.post('/upload-avatar', (req, res) => {
  const upload = req.app.locals.upload;
  
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          errorCode: 'FILE_TOO_LARGE',
          message: '文件大小超过限制（最大2MB）'
        });
      }
      
      if (err.message === 'Only JPG and PNG files are allowed') {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_FILE_TYPE',
          message: '只支持JPG和PNG格式的图片文件'
        });
      }
      
      return res.status(400).json({
        success: false,
        errorCode: 'UPLOAD_FAILED',
        message: '文件上传失败'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        errorCode: 'NO_FILE',
        message: '请选择要上传的文件'
      });
    }
    
    try {
      const { userId } = req.body;
      
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
      
      // Update user avatar URL
      const avatarUrl = `/uploads/${req.file.filename}`;
      const updatedUser = await updateUser(userId, { avatarUrl });
      
      res.json({
        success: true,
        avatarUrl: sanitizeAvatarUrl(updatedUser.avatarUrl),
        message: '头像上传成功'
      });
      
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({
        success: false,
        errorCode: 'AVATAR_UPDATE_FAILED',
        message: '头像更新失败'
      });
    }
  });
});

// Validate and parse QR code data
router.post('/validate-qr', async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_QR_DATA',
        message: '二维码数据不能为空'
      });
    }
    
    // Validate QR code format
    const parsedData = validateQRData(qrData);
    
    // Check if user exists
    const user = await getUserById(parsedData.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    }
    
    // Verify QR code belongs to the user
    if (user.qrCode !== qrData) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_QR_CODE',
        message: '无效的二维码'
      });
    }
    
    res.json({
      success: true,
      userId: user.id,
      numericId: user.numericId,
      name: user.name,
      gender: user.gender,
      avatarUrl: sanitizeAvatarUrl(user.avatarUrl),
      voteCount: user.voteCount,
      message: '二维码验证成功'
    });
    
  } catch (error) {
    console.error('QR validation error:', error);
    
    if (error.message.includes('QR data must be valid JSON') || 
        error.message.includes('Missing required field') ||
        error.message.includes('must be either') ||
        error.message.includes('must be a') ||
        error.message.includes('must be "vote"')) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_QR_FORMAT',
        message: '二维码格式错误'
      });
    }
    
    res.status(500).json({
      success: false,
      errorCode: 'QR_VALIDATION_FAILED',
      message: '二维码验证失败'
    });
  }
});

// Lookup user by numeric ID
router.post('/lookup-by-id', async (req, res) => {
  try {
    const { numericId } = req.body;
    
    if (!numericId) {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_NUMERIC_ID',
        message: '请输入6位数字ID'
      });
    }
    
    // Validate numeric ID format
    const numericIdStr = numericId.toString().trim();
    if (!/^\d{6}$/.test(numericIdStr)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_NUMERIC_ID_FORMAT',
        message: 'ID必须是6位数字'
      });
    }
    
    // Look up user by numeric ID
    const user = await getUserByNumericId(numericIdStr);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '未找到该ID对应的用户'
      });
    }
    
    res.json({
      success: true,
      userId: user.id,
      numericId: user.numericId,
      name: user.name,
      gender: user.gender,
      avatarUrl: sanitizeAvatarUrl(user.avatarUrl),
      voteCount: user.voteCount,
      message: 'ID验证成功'
    });
    
  } catch (error) {
    console.error('Numeric ID lookup error:', error);
    
    if (error.message.includes('Numeric ID must be exactly 6 digits')) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_NUMERIC_ID_FORMAT',
        message: 'ID必须是6位数字'
      });
    }
    
    res.status(500).json({
      success: false,
      errorCode: 'ID_LOOKUP_FAILED',
      message: 'ID查询失败，请稍后重试'
    });
  }
});

// Delete user account (for re-registration)
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_USER_ID',
        message: '用户ID不能为空'
      });
    }
    
    // Check if user exists before deletion
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    }
    
    // Delete user and all related data (votes, restrictions, etc.)
    await deleteUser(userId);
    
    res.json({
      success: true,
      message: '用户账号已删除，可以重新注册',
      deletedUser: {
        id: user.id,
        name: user.name,
        gender: user.gender
      }
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'DELETE_USER_FAILED',
      message: '删除用户失败，请稍后重试'
    });
  }
});

// Update user information (admin only)
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name } = req.body;
    
    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_NAME',
        message: '姓名不能为空'
      });
    }
    
    if (name.trim().length > 20) {
      return res.status(400).json({
        success: false,
        errorCode: 'NAME_TOO_LONG',
        message: '姓名长度不能超过20个字符'
      });
    }
    
    // Check if user exists
    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    }
    
    // Update user
    const updatedUser = await updateUser(userId, { name: name.trim() });
    
    res.json({
      success: true,
      message: '用户信息更新成功',
      user: {
        id: updatedUser.id,
        numericId: updatedUser.numericId,
        name: updatedUser.name,
        gender: updatedUser.gender,
        avatarUrl: sanitizeAvatarUrl(updatedUser.avatarUrl),
        voteCount: updatedUser.voteCount || 0,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'UPDATE_FAILED',
      message: '更新用户信息失败'
    });
  }
});

// Delete user (admin only)
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    }
    
    // Delete user
    await deleteUser(userId);
    
    res.json({
      success: true,
      message: '用户删除成功'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'DELETE_FAILED',
      message: '删除用户失败'
    });
  }
});

// Batch update QR codes with new base URL
router.post('/batch-update-qr', async (req, res) => {
  try {
    const { baseURL } = req.body;
    
    // Validate baseURL
    let validatedBaseURL = null;
    if (baseURL) {
      try {
        const url = new URL(baseURL);
        // Only allow http and https protocols
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          validatedBaseURL = `${url.protocol}//${url.host}`;
        } else {
          return res.status(400).json({
            success: false,
            errorCode: 'INVALID_BASE_URL',
            message: '无效的URL协议，只支持http和https'
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_BASE_URL',
          message: '无效的URL格式'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_BASE_URL',
        message: '请提供baseURL参数'
      });
    }
    
    // Get all users
    const users = await getAllUsers();
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Temporarily set the base URL
    const originalBaseURL = process.env.SERVER_BASE_URL;
    process.env.SERVER_BASE_URL = validatedBaseURL;
    
    try {
      for (const user of users) {
        try {
          // Skip users without QR codes
          if (!user.qrCode) {
            skippedCount++;
            continue;
          }
          
          // Get existing QR codes to ensure uniqueness
          const otherUsers = users.filter(u => u.id !== user.id && u.qrCode);
          const existingQRCodes = otherUsers.map(u => u.qrCode);
          
          // Generate new QR code with updated base URL
          const { qrData, qrCodeImage } = await generateCompleteQRCode(
            {
              userId: user.id,
              name: user.name,
              gender: user.gender
            },
            existingQRCodes
          );
          
          // Update user with new QR code
          await updateUser(user.id, {
            qrCode: qrData
          });
          
          updatedCount++;
          
        } catch (error) {
          console.error(`Failed to update QR code for user ${user.name}:`, error);
          errorCount++;
          errors.push({
            userId: user.id,
            userName: user.name,
            error: error.message
          });
        }
      }
    } finally {
      // Restore original base URL
      if (originalBaseURL) {
        process.env.SERVER_BASE_URL = originalBaseURL;
      } else {
        delete process.env.SERVER_BASE_URL;
      }
    }
    
    res.json({
      success: true,
      message: 'QR码批量更新完成',
      statistics: {
        total: users.length,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      baseURL: validatedBaseURL,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Batch QR update error:', error);
    res.status(500).json({
      success: false,
      errorCode: 'BATCH_UPDATE_FAILED',
      message: 'QR码批量更新失败'
    });
  }
});

module.exports = router;