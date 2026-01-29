/**
 * Integration tests for QR Code URL Generator
 * Tests the complete flow from candidate info to QR code generation
 */

import { createQRCodeURLGenerator, URLUtils } from './qr-code-url-generator';
import { CandidateInfo } from '../types/qr-code-voting';

describe('QR Code URL Generator Integration', () => {
  const generator = createQRCodeURLGenerator('https://voting.example.com');

  describe('Complete workflow', () => {
    it('should generate URL and QR code for candidate', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-001',
        name: '王小明',
        category: '最佳新人奖'
      };

      // Generate voting URL
      const votingURL = generator.generateVotingURL(candidateInfo);
      
      // Validate the URL
      expect(generator.validateURL(votingURL)).toBe(true);
      
      // Parse the URL to verify parameters
      const params = URLUtils.parseVotingURL(votingURL);
      expect(params).not.toBeNull();
      expect(params!.candidate_id).toBe('candidate-001');
      expect(params!.candidate_name).toBe('王小明');
      expect(params!.category).toBe('最佳新人奖');
      expect(params!.source).toBe('qrcode');
      expect(params!.timestamp).toBeTruthy();

      // Generate QR code
      const qrCodeData = await generator.generateQRCode(votingURL);
      
      expect(qrCodeData.url).toBe(votingURL);
      expect(qrCodeData.imageData).toMatch(/^data:image\/png;base64,/);
      expect(qrCodeData.timestamp).toBeInstanceOf(Date);
    });

    it('should handle candidate without category', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-002',
        name: '李华'
      };

      const votingURL = generator.generateVotingURL(candidateInfo);
      const params = URLUtils.parseVotingURL(votingURL);
      
      expect(params!.candidate_id).toBe('candidate-002');
      expect(params!.candidate_name).toBe('李华');
      expect(params!.category).toBeUndefined();
      
      const qrCodeData = await generator.generateQRCode(votingURL);
      expect(qrCodeData.url).toBe(votingURL);
    });

    it('should extract candidate ID from generated URL', () => {
      const candidateInfo: CandidateInfo = {
        id: 'test-candidate-123',
        name: '测试候选人'
      };

      const votingURL = generator.generateVotingURL(candidateInfo);
      const extractedId = URLUtils.extractCandidateId(votingURL);
      
      expect(extractedId).toBe('test-candidate-123');
    });

    it('should identify voting URLs correctly', () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-456',
        name: '另一个候选人'
      };

      const votingURL = generator.generateVotingURL(candidateInfo);
      
      expect(URLUtils.isVotingURL(votingURL)).toBe(true);
      expect(URLUtils.isVotingURL('https://example.com/other')).toBe(false);
      expect(URLUtils.isVotingURL('https://example.com/vote')).toBe(false); // No candidate_id
    });
  });

  describe('Error handling', () => {
    it('should handle invalid candidate info gracefully', () => {
      const invalidCandidateInfo = {
        id: '',
        name: 'Valid Name'
      } as CandidateInfo;

      expect(() => generator.generateVotingURL(invalidCandidateInfo))
        .toThrow('Candidate ID is required and must be a string');
    });

    it('should handle QR code generation errors', async () => {
      const invalidURL = 'not-a-valid-url';
      
      await expect(generator.generateQRCode(invalidURL))
        .rejects.toThrow('Invalid URL provided for QR code generation');
    });
  });

  describe('URL validation edge cases', () => {
    it('should validate URLs with different base URLs', () => {
      const generator1 = createQRCodeURLGenerator('https://site1.com');
      const generator2 = createQRCodeURLGenerator('https://site2.com');
      
      const candidateInfo: CandidateInfo = {
        id: 'candidate-789',
        name: '跨域测试'
      };

      const url1 = generator1.generateVotingURL(candidateInfo);
      const url2 = generator2.generateVotingURL(candidateInfo);
      
      // Both generators should validate their own URLs
      expect(generator1.validateURL(url1)).toBe(true);
      expect(generator2.validateURL(url2)).toBe(true);
      
      // URLs should have different domains
      expect(url1).toContain('site1.com');
      expect(url2).toContain('site2.com');
    });

    it('should handle Unicode characters in candidate names', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'unicode-test',
        name: '张三李四王五赵六'
      };

      const votingURL = generator.generateVotingURL(candidateInfo);
      expect(generator.validateURL(votingURL)).toBe(true);
      
      const params = URLUtils.parseVotingURL(votingURL);
      expect(params!.candidate_name).toBe('张三李四王五赵六');
      
      // Should be able to generate QR code
      const qrCodeData = await generator.generateQRCode(votingURL);
      expect(qrCodeData.imageData).toBeTruthy();
    });
  });
});