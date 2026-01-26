const {
  generateQRData,
  generateQRCodeImage,
  validateQRData,
  isQRCodeUnique,
  generateCompleteQRCode,
  extractUserIdFromQR
} = require('./qrcode');

describe('QR Code Utilities', () => {
  const mockUserData = {
    userId: 'test-user-123',
    name: '张三',
    gender: 'male'
  };

  describe('generateQRData', () => {
    it('should generate valid QR data with all required fields', () => {
      const qrData = generateQRData(mockUserData);
      const parsedData = JSON.parse(qrData);
      
      expect(parsedData.userId).toBe(mockUserData.userId);
      expect(parsedData.name).toBe(mockUserData.name);
      expect(parsedData.gender).toBe(mockUserData.gender);
      expect(parsedData.type).toBe('vote');
      expect(typeof parsedData.timestamp).toBe('number');
      expect(typeof parsedData.nonce).toBe('string');
    });

    it('should generate unique QR data for identical user data', () => {
      const qrData1 = generateQRData(mockUserData);
      const qrData2 = generateQRData(mockUserData);
      
      expect(qrData1).not.toBe(qrData2);
      
      const parsed1 = JSON.parse(qrData1);
      const parsed2 = JSON.parse(qrData2);
      
      // Same user data but different nonce and timestamp
      expect(parsed1.userId).toBe(parsed2.userId);
      expect(parsed1.nonce).not.toBe(parsed2.nonce);
    });

    it('should throw error for missing required fields', () => {
      expect(() => generateQRData({})).toThrow('Missing required user data');
      expect(() => generateQRData({ userId: 'test' })).toThrow('Missing required user data');
      expect(() => generateQRData({ userId: 'test', name: 'Test' })).toThrow('Missing required user data');
    });
  });

  describe('generateQRCodeImage', () => {
    it('should generate base64 encoded PNG image', async () => {
      const qrData = generateQRData(mockUserData);
      const qrImage = await generateQRCodeImage(qrData);
      
      expect(qrImage).toMatch(/^data:image\/png;base64,/);
      expect(qrImage.length).toBeGreaterThan(100); // Should be a substantial base64 string
    });

    it('should use custom options when provided', async () => {
      const qrData = generateQRData(mockUserData);
      const customOptions = {
        width: 128,
        color: {
          dark: '#FF0000',
          light: '#00FF00'
        }
      };
      
      const qrImage = await generateQRCodeImage(qrData, customOptions);
      expect(qrImage).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle QR code generation errors', async () => {
      // Test with invalid data that might cause QR generation to fail
      await expect(generateQRCodeImage(null)).rejects.toThrow('QR code generation failed');
    });
  });

  describe('validateQRData', () => {
    it('should validate correct QR data', () => {
      const qrData = generateQRData(mockUserData);
      const validatedData = validateQRData(qrData);
      
      expect(validatedData.userId).toBe(mockUserData.userId);
      expect(validatedData.name).toBe(mockUserData.name);
      expect(validatedData.gender).toBe(mockUserData.gender);
      expect(validatedData.type).toBe('vote');
    });

    it('should reject invalid JSON', () => {
      expect(() => validateQRData('invalid json')).toThrow('QR data must be valid JSON');
      expect(() => validateQRData('')).toThrow('QR data must be a non-empty string');
      expect(() => validateQRData(null)).toThrow('QR data must be a non-empty string');
    });

    it('should reject missing required fields', () => {
      const incompleteData = JSON.stringify({
        userId: 'test',
        name: 'Test'
        // missing gender, timestamp, type
      });
      
      expect(() => validateQRData(incompleteData)).toThrow('Missing required field');
    });

    it('should reject invalid field types', () => {
      const invalidData = JSON.stringify({
        userId: 123, // should be string
        name: 'Test',
        gender: 'male',
        timestamp: Date.now(),
        type: 'vote'
      });
      
      expect(() => validateQRData(invalidData)).toThrow('userId must be a string');
    });

    it('should reject invalid gender values', () => {
      const invalidGenderData = JSON.stringify({
        userId: 'test',
        name: 'Test',
        gender: 'other', // invalid gender
        timestamp: Date.now(),
        type: 'vote'
      });
      
      expect(() => validateQRData(invalidGenderData)).toThrow('gender must be either "male" or "female"');
    });

    it('should reject invalid type values', () => {
      const invalidTypeData = JSON.stringify({
        userId: 'test',
        name: 'Test',
        gender: 'male',
        timestamp: Date.now(),
        type: 'invalid' // should be 'vote'
      });
      
      expect(() => validateQRData(invalidTypeData)).toThrow('type must be "vote"');
    });
  });

  describe('isQRCodeUnique', () => {
    it('should return true for unique QR codes', () => {
      const qrData1 = generateQRData(mockUserData);
      const qrData2 = generateQRData({ ...mockUserData, userId: 'different-user' });
      
      expect(isQRCodeUnique(qrData1, [])).toBe(true);
      expect(isQRCodeUnique(qrData1, [qrData2])).toBe(true);
    });

    it('should return false for duplicate QR codes', () => {
      const qrData = generateQRData(mockUserData);
      
      expect(isQRCodeUnique(qrData, [qrData])).toBe(false);
    });

    it('should return false for same user ID', () => {
      const qrData1 = generateQRData(mockUserData);
      const qrData2 = generateQRData(mockUserData); // Same user, different nonce/timestamp
      
      expect(isQRCodeUnique(qrData1, [qrData2])).toBe(false);
    });

    it('should handle invalid existing QR codes gracefully', () => {
      const qrData = generateQRData(mockUserData);
      const invalidExisting = ['invalid json', '{"incomplete": "data"}'];
      
      expect(isQRCodeUnique(qrData, invalidExisting)).toBe(true);
    });

    it('should handle non-array input gracefully', () => {
      const qrData = generateQRData(mockUserData);
      
      expect(isQRCodeUnique(qrData, null)).toBe(true);
      expect(isQRCodeUnique(qrData, undefined)).toBe(true);
    });
  });

  describe('generateCompleteQRCode', () => {
    it('should generate both QR data and image', async () => {
      const result = await generateCompleteQRCode(mockUserData);
      
      expect(result).toHaveProperty('qrData');
      expect(result).toHaveProperty('qrCodeImage');
      expect(result.qrCodeImage).toMatch(/^data:image\/png;base64,/);
      
      // Validate the generated QR data
      const parsedData = JSON.parse(result.qrData);
      expect(parsedData.userId).toBe(mockUserData.userId);
    });

    it('should ensure uniqueness against existing QR codes', async () => {
      const existingQR = generateQRData(mockUserData);
      
      // This should fail because we're trying to generate for the same user
      await expect(generateCompleteQRCode(mockUserData, [existingQR]))
        .rejects.toThrow('Failed to generate unique QR code');
    });

    it('should work with different users', async () => {
      const user1QR = generateQRData(mockUserData);
      const user2Data = { ...mockUserData, userId: 'different-user' };
      
      const result = await generateCompleteQRCode(user2Data, [user1QR]);
      
      expect(result.qrData).toBeDefined();
      expect(result.qrCodeImage).toBeDefined();
      
      const parsedData = JSON.parse(result.qrData);
      expect(parsedData.userId).toBe('different-user');
    });

    it('should use custom image options', async () => {
      const customOptions = { width: 128 };
      const result = await generateCompleteQRCode(mockUserData, [], customOptions);
      
      expect(result.qrCodeImage).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('extractUserIdFromQR', () => {
    it('should extract user ID from valid QR data', () => {
      const qrData = generateQRData(mockUserData);
      const userId = extractUserIdFromQR(qrData);
      
      expect(userId).toBe(mockUserData.userId);
    });

    it('should return null for invalid QR data', () => {
      expect(extractUserIdFromQR('invalid json')).toBeNull();
      expect(extractUserIdFromQR('')).toBeNull();
      expect(extractUserIdFromQR(null)).toBeNull();
    });

    it('should return null for QR data missing userId', () => {
      const incompleteData = JSON.stringify({
        name: 'Test',
        gender: 'male',
        timestamp: Date.now(),
        type: 'vote'
      });
      
      expect(extractUserIdFromQR(incompleteData)).toBeNull();
    });
  });

  // Property-based tests for QR code uniqueness
  describe('Property Tests', () => {
    /**
     * **Validates: Requirements 1.5, 3.1, 3.2**
     * Property: QR code uniqueness guarantee
     * For any set of different users, generated QR codes should be unique
     */
    it('should generate unique QR codes for different users', () => {
      const users = [
        { userId: 'user1', name: '张三', gender: 'male' },
        { userId: 'user2', name: '李四', gender: 'female' },
        { userId: 'user3', name: '王五', gender: 'male' },
        { userId: 'user4', name: '赵六', gender: 'female' }
      ];
      
      const qrCodes = users.map(user => generateQRData(user));
      
      // All QR codes should be different
      const uniqueQRCodes = new Set(qrCodes);
      expect(uniqueQRCodes.size).toBe(qrCodes.length);
      
      // Each QR code should be unique when checked against others
      for (let i = 0; i < qrCodes.length; i++) {
        const otherQRCodes = qrCodes.filter((_, index) => index !== i);
        expect(isQRCodeUnique(qrCodes[i], otherQRCodes)).toBe(true);
      }
    });

    /**
     * **Validates: Requirements 3.3, 3.4**
     * Property: QR code round-trip consistency
     * For any generated QR code, scanning should correctly identify the original user
     */
    it('should maintain round-trip consistency for QR codes', () => {
      const testUsers = [
        { userId: 'test1', name: 'Alice', gender: 'female' },
        { userId: 'test2', name: 'Bob', gender: 'male' },
        { userId: 'test3', name: '中文姓名', gender: 'female' }
      ];
      
      testUsers.forEach(user => {
        const qrData = generateQRData(user);
        
        // Should be able to validate the QR data
        const validatedData = validateQRData(qrData);
        expect(validatedData.userId).toBe(user.userId);
        expect(validatedData.name).toBe(user.name);
        expect(validatedData.gender).toBe(user.gender);
        
        // Should be able to extract user ID
        const extractedUserId = extractUserIdFromQR(qrData);
        expect(extractedUserId).toBe(user.userId);
      });
    });
  });
});