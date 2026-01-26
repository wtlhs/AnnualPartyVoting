const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

/**
 * QR Code utility functions for the annual party voting system
 * Handles QR code generation, validation, and uniqueness verification
 */

/**
 * Generate QR code data for a user
 * @param {Object} userData - User data object
 * @param {string} userData.userId - User ID
 * @param {string} userData.name - User name
 * @param {string} userData.gender - User gender
 * @returns {string} JSON string containing QR code data
 */
function generateQRData(userData) {
  const { userId, name, gender } = userData;
  
  if (!userId || !name || !gender) {
    throw new Error('Missing required user data for QR code generation');
  }
  
  const qrData = {
    userId,
    name,
    gender,
    timestamp: Date.now(),
    type: 'vote',
    // Add a unique nonce to ensure uniqueness even for identical user data
    nonce: uuidv4()
  };
  
  return JSON.stringify(qrData);
}

/**
 * Generate QR code as base64 image
 * @param {string} qrData - QR code data string
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} Base64 encoded QR code image
 */
async function generateQRCodeImage(qrData, options = {}) {
  const defaultOptions = {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    width: 256
  };
  
  const qrOptions = { ...defaultOptions, ...options };
  
  try {
    return await QRCode.toDataURL(qrData, qrOptions);
  } catch (error) {
    throw new Error(`QR code generation failed: ${error.message}`);
  }
}

/**
 * Validate QR code data format
 * @param {string} qrData - QR code data string
 * @returns {Object} Parsed and validated QR data
 * @throws {Error} If QR data is invalid
 */
function validateQRData(qrData) {
  if (!qrData || typeof qrData !== 'string') {
    throw new Error('QR data must be a non-empty string');
  }
  
  let parsedData;
  try {
    parsedData = JSON.parse(qrData);
  } catch (error) {
    throw new Error('QR data must be valid JSON');
  }
  
  // Validate required fields
  const requiredFields = ['userId', 'name', 'gender', 'timestamp', 'type'];
  for (const field of requiredFields) {
    if (!parsedData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate field types and values
  if (typeof parsedData.userId !== 'string') {
    throw new Error('userId must be a string');
  }
  
  if (typeof parsedData.name !== 'string') {
    throw new Error('name must be a string');
  }
  
  if (!['male', 'female'].includes(parsedData.gender)) {
    throw new Error('gender must be either "male" or "female"');
  }
  
  if (typeof parsedData.timestamp !== 'number' || parsedData.timestamp <= 0) {
    throw new Error('timestamp must be a positive number');
  }
  
  if (parsedData.type !== 'vote') {
    throw new Error('type must be "vote"');
  }
  
  return parsedData;
}

/**
 * Check if QR code data is unique by comparing with existing QR codes
 * @param {string} qrData - QR code data to check
 * @param {Array<string>} existingQRCodes - Array of existing QR code data strings
 * @returns {boolean} True if QR code is unique
 */
function isQRCodeUnique(qrData, existingQRCodes) {
  if (!Array.isArray(existingQRCodes)) {
    return true;
  }
  
  // Check for exact matches
  if (existingQRCodes.includes(qrData)) {
    return false;
  }
  
  try {
    const newData = JSON.parse(qrData);
    
    // Check for duplicate user IDs (each user should have only one QR code)
    for (const existingQR of existingQRCodes) {
      try {
        const existingData = JSON.parse(existingQR);
        if (existingData.userId === newData.userId) {
          return false;
        }
      } catch (error) {
        // Skip invalid existing QR codes
        continue;
      }
    }
    
    return true;
  } catch (error) {
    // If we can't parse the new QR data, consider it non-unique for safety
    return false;
  }
}

/**
 * Generate a complete QR code (data + image) for a user
 * @param {Object} userData - User data object
 * @param {Array<string>} existingQRCodes - Array of existing QR code data strings
 * @param {Object} imageOptions - QR code image generation options
 * @returns {Promise<Object>} Object containing qrData and qrCodeImage
 */
async function generateCompleteQRCode(userData, existingQRCodes = [], imageOptions = {}) {
  let qrData;
  let attempts = 0;
  const maxAttempts = 10;
  
  // Generate unique QR data (retry if not unique due to timestamp/nonce collision)
  do {
    qrData = generateQRData(userData);
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique QR code after maximum attempts');
    }
  } while (!isQRCodeUnique(qrData, existingQRCodes));
  
  // Generate QR code image
  const qrCodeImage = await generateQRCodeImage(qrData, imageOptions);
  
  return {
    qrData,
    qrCodeImage
  };
}

/**
 * Extract user ID from QR code data
 * @param {string} qrData - QR code data string
 * @returns {string|null} User ID or null if invalid
 */
function extractUserIdFromQR(qrData) {
  try {
    const parsedData = validateQRData(qrData);
    return parsedData.userId;
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateQRData,
  generateQRCodeImage,
  validateQRData,
  isQRCodeUnique,
  generateCompleteQRCode,
  extractUserIdFromQR
};