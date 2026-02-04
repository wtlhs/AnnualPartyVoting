const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

/**
 * QR Code utility functions for the annual party voting system
 * Handles QR code generation, validation, and uniqueness verification
 * Updated to generate voting URLs instead of personal information JSON
 */

/**
 * Get the current server base URL
 * @returns {string} Base URL for the server
 */
function getServerBaseURL() {
  // Try to get from environment variables first
  if (process.env.SERVER_BASE_URL) {
    return process.env.SERVER_BASE_URL;
  }
  
  // Default to LAN IP address used in the server
  return 'http://192.168.0.97:3000';
}

/**
 * Generate voting URL for a user (uses the original vote confirmation page)
 * @param {Object} userData - User data object
 * @param {string} userData.userId - User ID
 * @param {string} userData.name - User name
 * @param {string} userData.gender - User gender (optional, for category)
 * @returns {string} Voting URL for the user
 */
function generateQRData(userData) {
  const { userId, name } = userData;
  
  if (!userId || !name) {
    throw new Error('Missing required user data for QR code generation');
  }
  
  // Generate voting URL using the original vote confirmation page format
  const baseURL = getServerBaseURL();
  
  // Construct the voting URL pointing to the original vote confirmation page
  const votingURL = `${baseURL}/vote/${userId}`;
  
  return votingURL;
}

/**
 * Generate QR code as base64 image
 * @param {string} qrData - QR code data string (now a URL)
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} Base64 encoded QR code image
 */
async function generateQRCodeImage(qrData, options = {}) {
  const defaultOptions = {
    errorCorrectionLevel: 'H', // High error correction for better WeChat scanning
    type: 'image/png',
    quality: 0.92,
    margin: 2, // Increased margin for better WeChat recognition
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    width: 256 // Default size suitable for mobile screens
  };
  
  const qrOptions = { ...defaultOptions, ...options };
  
  try {
    return await QRCode.toDataURL(qrData, qrOptions);
  } catch (error) {
    throw new Error(`QR code generation failed: ${error.message}`);
  }
}

/**
 * Validate QR code data format (now validates URL format for vote confirmation page)
 * @param {string} qrData - QR code data string (URL)
 * @returns {Object} Parsed URL information
 * @throws {Error} If QR data is invalid
 */
function validateQRData(qrData) {
  if (!qrData || typeof qrData !== 'string') {
    throw new Error('QR data must be a non-empty string');
  }
  
  try {
    const url = new URL(qrData);
    
    // Validate that it's a voting URL (either new format /vote?params or original format /vote/:userId)
    if (!url.pathname.includes('/vote')) {
      throw new Error('QR data must be a voting URL');
    }
    
    // Check if it's the original vote confirmation page format (/vote/:userId)
    const pathParts = url.pathname.split('/');
    if (pathParts.length === 3 && pathParts[1] === 'vote' && pathParts[2]) {
      const userId = pathParts[2];
      
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID cannot be empty');
      }
      
      return {
        url: qrData,
        candidateId: userId,
        format: 'original' // Original vote confirmation page format
      };
    }
    
    // Check if it's the new format with query parameters (for backward compatibility)
    if (url.pathname.endsWith('/vote') && url.search) {
      const params = url.searchParams;
      const requiredParams = ['candidate_id', 'candidate_name', 'source', 'timestamp'];
      
      for (const param of requiredParams) {
        if (!params.has(param)) {
          throw new Error(`Missing required parameter: ${param}`);
        }
      }
      
      // Validate parameter values
      const candidateId = params.get('candidate_id');
      const candidateName = params.get('candidate_name');
      const source = params.get('source');
      const timestamp = params.get('timestamp');
      
      if (!candidateId || candidateId.trim().length === 0) {
        throw new Error('candidate_id cannot be empty');
      }
      
      if (!candidateName || candidateName.trim().length === 0) {
        throw new Error('candidate_name cannot be empty');
      }
      
      if (source !== 'qrcode') {
        throw new Error('source must be "qrcode" for QR code generated URLs');
      }
      
      const timestampNum = parseInt(timestamp);
      if (isNaN(timestampNum) || timestampNum <= 0) {
        throw new Error('timestamp must be a valid positive number');
      }
      
      // Check if timestamp is not too old (24 hours)
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 24 * 60 * 60; // 24 hours in seconds
      if (now - timestampNum > maxAge) {
        throw new Error('QR code has expired (older than 24 hours)');
      }
      
      return {
        url: qrData,
        candidateId,
        candidateName,
        category: params.get('category'),
        source,
        timestamp: timestampNum,
        format: 'new' // New format with query parameters
      };
    }
    
    throw new Error('Invalid voting URL format');
    
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('QR data must be a valid URL');
    }
    throw error;
  }
}

/**
 * Check if QR code data is unique by comparing with existing QR codes
 * @param {string} qrData - QR code data to check (URL)
 * @param {Array<string>} existingQRCodes - Array of existing QR code data strings (URLs)
 * @returns {boolean} True if QR code is unique
 */
function isQRCodeUnique(qrData, existingQRCodes) {
  if (!Array.isArray(existingQRCodes)) {
    return true;
  }
  
  // Check for exact URL matches
  if (existingQRCodes.includes(qrData)) {
    return false;
  }
  
  try {
    const validatedData = validateQRData(qrData);
    const newCandidateId = validatedData.candidateId;
    
    if (!newCandidateId) {
      return false;
    }
    
    // Check for duplicate candidate IDs (each user should have only one QR code)
    for (const existingQR of existingQRCodes) {
      try {
        // Handle multiple formats: old JSON, new URL with params, and original vote confirmation URL
        if (existingQR.startsWith('http')) {
          // URL format - try to validate and extract candidate ID
          try {
            const existingValidated = validateQRData(existingQR);
            if (existingValidated.candidateId === newCandidateId) {
              return false;
            }
          } catch (validationError) {
            // Skip invalid URLs
            continue;
          }
        } else {
          // Old JSON format - try to parse
          try {
            const existingData = JSON.parse(existingQR);
            if (existingData.userId === newCandidateId) {
              return false;
            }
          } catch (jsonError) {
            // Skip invalid JSON
            continue;
          }
        }
      } catch (error) {
        // Skip any problematic entries
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
 * @returns {Promise<Object>} Object containing qrData (URL) and qrCodeImage
 */
async function generateCompleteQRCode(userData, existingQRCodes = [], imageOptions = {}) {
  // Generate QR data (URL pointing to vote confirmation page)
  const qrData = generateQRData(userData);
  
  // Check if QR code is unique
  if (!isQRCodeUnique(qrData, existingQRCodes)) {
    throw new Error('QR code already exists for this user');
  }
  
  // Generate QR code image
  const qrCodeImage = await generateQRCodeImage(qrData, imageOptions);
  
  return {
    qrData,
    qrCodeImage
  };
}

/**
 * Extract user ID from QR code data (URL)
 * @param {string} qrData - QR code data string (URL)
 * @returns {string|null} User ID or null if invalid
 */
function extractUserIdFromQR(qrData) {
  try {
    const validatedData = validateQRData(qrData);
    return validatedData.candidateId;
  } catch (error) {
    // Try old JSON format for backward compatibility
    try {
      const parsedData = JSON.parse(qrData);
      return parsedData.userId || null;
    } catch (jsonError) {
      return null;
    }
  }
}

/**
 * Set the server base URL (useful for testing or different environments)
 * @param {string} baseURL - New base URL
 */
function setServerBaseURL(baseURL) {
  process.env.SERVER_BASE_URL = baseURL;
}

module.exports = {
  generateQRData,
  generateQRCodeImage,
  validateQRData,
  isQRCodeUnique,
  generateCompleteQRCode,
  extractUserIdFromQR,
  getServerBaseURL,
  setServerBaseURL
};