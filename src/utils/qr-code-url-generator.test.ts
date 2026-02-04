/**
 * Unit tests for QR Code URL Generator
 * Tests the implementation of voting URL generation and validation
 */

import { VotingQRCodeURLGenerator, createQRCodeURLGenerator, URLUtils, QRCodePresets, QRCodeHelpers } from './qr-code-url-generator';
import { CandidateInfo, QRCodeGenerationOptions } from '../types/qr-code-voting';

describe('VotingQRCodeURLGenerator', () => {
  let generator: VotingQRCodeURLGenerator;
  const baseURL = 'https://example.com';

  beforeEach(() => {
    generator = new VotingQRCodeURLGenerator(baseURL);
  });

  describe('generateVotingURL', () => {
    it('should generate valid voting URL with required parameters', () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const url = generator.generateVotingURL(candidateInfo);
      const urlObj = new URL(url);

      expect(urlObj.origin).toBe(baseURL);
      expect(urlObj.pathname).toBe('/vote');
      expect(urlObj.searchParams.get('candidate_id')).toBe('candidate-123');
      expect(urlObj.searchParams.get('candidate_name')).toBe('张三');
      expect(urlObj.searchParams.get('source')).toBe('qrcode');
      expect(urlObj.searchParams.get('timestamp')).toBeTruthy();
    });

    it('should include category when provided', () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三',
        category: '最佳员工'
      };

      const url = generator.generateVotingURL(candidateInfo);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('category')).toBe('最佳员工');
    });

    it('should properly encode special characters in parameters', () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三李四',
        category: '最佳员工2024'
      };

      const url = generator.generateVotingURL(candidateInfo);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('candidate_name')).toBe('张三李四');
      expect(urlObj.searchParams.get('category')).toBe('最佳员工2024');
    });

    it('should throw error for invalid candidate ID', () => {
      const candidateInfo: CandidateInfo = {
        id: 'invalid@id!',
        name: '张三'
      };

      expect(() => generator.generateVotingURL(candidateInfo)).toThrow('Candidate ID contains invalid characters');
    });

    it('should throw error for empty candidate name', () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: ''
      };

      expect(() => generator.generateVotingURL(candidateInfo)).toThrow('Candidate name is required and must be a string');
    });

    it('should throw error for candidate name that is too long', () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: 'a'.repeat(51) // Exceeds MAX_CANDIDATE_NAME_LENGTH
      };

      expect(() => generator.generateVotingURL(candidateInfo)).toThrow('Candidate name must be between');
    });

    it('should throw error for invalid candidate name characters', () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三<script>alert("xss")</script>'
      };

      expect(() => generator.generateVotingURL(candidateInfo)).toThrow('Candidate name contains invalid characters');
    });

    it('should generate different timestamps for consecutive calls', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const url1 = generator.generateVotingURL(candidateInfo);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1100));
      const url2 = generator.generateVotingURL(candidateInfo);

      const timestamp1 = new URL(url1).searchParams.get('timestamp');
      const timestamp2 = new URL(url2).searchParams.get('timestamp');

      expect(timestamp1).not.toBe(timestamp2);
    });
  });

  describe('validateURL', () => {
    it('should validate correct voting URL', () => {
      const validURL = `${baseURL}/vote?candidate_id=candidate-123&candidate_name=张三&source=qrcode&timestamp=${Math.floor(Date.now() / 1000)}`;
      
      expect(generator.validateURL(validURL)).toBe(true);
    });

    it('should reject URL without required parameters', () => {
      const invalidURL = `${baseURL}/vote?candidate_id=candidate-123`;
      
      expect(generator.validateURL(invalidURL)).toBe(false);
    });

    it('should reject URL with invalid candidate ID', () => {
      const invalidURL = `${baseURL}/vote?candidate_id=invalid@id&candidate_name=张三&source=qrcode&timestamp=${Math.floor(Date.now() / 1000)}`;
      
      expect(generator.validateURL(invalidURL)).toBe(false);
    });

    it('should reject URL with invalid source', () => {
      const invalidURL = `${baseURL}/vote?candidate_id=candidate-123&candidate_name=张三&source=invalid&timestamp=${Math.floor(Date.now() / 1000)}`;
      
      expect(generator.validateURL(invalidURL)).toBe(false);
    });

    it('should reject URL with expired timestamp', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - (25 * 3600); // 25 hours ago
      const invalidURL = `${baseURL}/vote?candidate_id=candidate-123&candidate_name=张三&source=qrcode&timestamp=${expiredTimestamp}`;
      
      expect(generator.validateURL(invalidURL)).toBe(false);
    });

    it('should accept URL with valid recent timestamp', () => {
      const recentTimestamp = Math.floor(Date.now() / 1000) - (1 * 3600); // 1 hour ago
      const validURL = `${baseURL}/vote?candidate_id=candidate-123&candidate_name=张三&source=qrcode&timestamp=${recentTimestamp}`;
      
      expect(generator.validateURL(validURL)).toBe(true);
    });

    it('should reject malformed URL', () => {
      const malformedURL = 'not-a-url';
      
      expect(generator.validateURL(malformedURL)).toBe(false);
    });

    it('should reject URL with wrong path', () => {
      const wrongPathURL = `${baseURL}/wrong-path?candidate_id=candidate-123&candidate_name=张三&source=qrcode&timestamp=${Math.floor(Date.now() / 1000)}`;
      
      expect(generator.validateURL(wrongPathURL)).toBe(false);
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code data for valid URL', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const url = generator.generateVotingURL(candidateInfo);
      const qrCodeData = await generator.generateQRCode(url);

      expect(qrCodeData.url).toBe(url);
      expect(qrCodeData.imageData).toMatch(/^data:image\/png;base64,/);
      expect(qrCodeData.timestamp).toBeInstanceOf(Date);
      expect(qrCodeData.format).toBe('png');
      expect(qrCodeData.size).toBe(256);
    });

    it('should generate QR code with custom options', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const options: QRCodeGenerationOptions = {
        format: 'png', // Use PNG as it's more widely supported
        size: 512,
        margin: 3,
        errorCorrection: 'H',
        darkColor: '#333333',
        lightColor: '#EEEEEE',
        quality: 0.8
      };

      const url = generator.generateVotingURL(candidateInfo);
      const qrCodeData = await generator.generateQRCode(url, options);

      expect(qrCodeData.url).toBe(url);
      expect(qrCodeData.imageData).toMatch(/^data:image\/png;base64,/);
      expect(qrCodeData.format).toBe('png');
      expect(qrCodeData.size).toBe(512);
    });

    it('should generate QR code with WeChat preset', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const url = generator.generateVotingURL(candidateInfo);
      const qrCodeData = await generator.generateQRCode(url, QRCodePresets.wechat);

      expect(qrCodeData.url).toBe(url);
      expect(qrCodeData.imageData).toMatch(/^data:image\/png;base64,/);
      expect(qrCodeData.format).toBe('png');
      expect(qrCodeData.size).toBe(256);
    });

    it('should throw error for invalid URL', async () => {
      const invalidURL = 'invalid-url';

      await expect(generator.generateQRCode(invalidURL)).rejects.toThrow('Invalid URL provided for QR code generation');
    });
  });

  describe('generateQRCodeBuffer', () => {
    it('should generate QR code buffer for PNG format', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const url = generator.generateVotingURL(candidateInfo);
      const qrCodeBuffer = await generator.generateQRCodeBuffer(url, { format: 'png' });

      expect(qrCodeBuffer.url).toBe(url);
      expect(qrCodeBuffer.buffer).toBeInstanceOf(Buffer);
      expect(qrCodeBuffer.format).toBe('png');
      expect(qrCodeBuffer.mimeType).toBe('image/png');
      expect(qrCodeBuffer.size).toBe(256);
    });

    it('should generate QR code buffer for SVG format', async () => {
      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const url = generator.generateVotingURL(candidateInfo);
      const qrCodeBuffer = await generator.generateQRCodeBuffer(url, { format: 'svg' });

      expect(qrCodeBuffer.url).toBe(url);
      expect(qrCodeBuffer.buffer).toBeInstanceOf(Buffer);
      expect(qrCodeBuffer.format).toBe('svg');
      expect(qrCodeBuffer.mimeType).toBe('image/svg+xml');
    });

    it('should throw error for invalid URL', async () => {
      const invalidURL = 'invalid-url';

      await expect(generator.generateQRCodeBuffer(invalidURL)).rejects.toThrow('Invalid URL provided for QR code generation');
    });
  });

  describe('setBaseURL and getBaseURL', () => {
    it('should update base URL', () => {
      const newBaseURL = 'https://newdomain.com';
      generator.setBaseURL(newBaseURL);

      expect(generator.getBaseURL()).toBe(newBaseURL);
    });

    it('should remove trailing slash from base URL', () => {
      const baseURLWithSlash = 'https://example.com/';
      generator.setBaseURL(baseURLWithSlash);

      expect(generator.getBaseURL()).toBe('https://example.com');
    });

    it('should generate URLs with new base URL', () => {
      const newBaseURL = 'https://newdomain.com';
      generator.setBaseURL(newBaseURL);

      const candidateInfo: CandidateInfo = {
        id: 'candidate-123',
        name: '张三'
      };

      const url = generator.generateVotingURL(candidateInfo);
      expect(url.startsWith(newBaseURL)).toBe(true);
    });
  });
});

describe('createQRCodeURLGenerator', () => {
  it('should create generator with default base URL', () => {
    const generator = createQRCodeURLGenerator();
    expect(generator.getBaseURL()).toBe('https://domain.com');
  });

  it('should create generator with custom base URL', () => {
    const customBaseURL = 'https://custom.com';
    const generator = createQRCodeURLGenerator(customBaseURL);
    expect(generator.getBaseURL()).toBe(customBaseURL);
  });
});

describe('URLUtils', () => {
  describe('parseVotingURL', () => {
    it('should parse valid voting URL parameters', () => {
      const url = 'https://example.com/vote?candidate_id=candidate-123&candidate_name=张三&source=qrcode';
      const params = URLUtils.parseVotingURL(url);

      expect(params).toEqual({
        candidate_id: 'candidate-123',
        candidate_name: '张三',
        source: 'qrcode'
      });
    });

    it('should return null for invalid URL', () => {
      const invalidURL = 'not-a-url';
      const params = URLUtils.parseVotingURL(invalidURL);

      expect(params).toBeNull();
    });

    it('should decode URL-encoded parameters', () => {
      const url = 'https://example.com/vote?candidate_name=%E5%BC%A0%E4%B8%89'; // URL-encoded "张三"
      const params = URLUtils.parseVotingURL(url);

      expect(params?.candidate_name).toBe('张三');
    });
  });

  describe('extractCandidateId', () => {
    it('should extract candidate ID from voting URL', () => {
      const url = 'https://example.com/vote?candidate_id=candidate-123&candidate_name=张三';
      const candidateId = URLUtils.extractCandidateId(url);

      expect(candidateId).toBe('candidate-123');
    });

    it('should return null if candidate ID not found', () => {
      const url = 'https://example.com/vote?candidate_name=张三';
      const candidateId = URLUtils.extractCandidateId(url);

      expect(candidateId).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const invalidURL = 'not-a-url';
      const candidateId = URLUtils.extractCandidateId(invalidURL);

      expect(candidateId).toBeNull();
    });
  });

  describe('isVotingURL', () => {
    it('should identify valid voting URL', () => {
      const url = 'https://example.com/vote?candidate_id=candidate-123';
      
      expect(URLUtils.isVotingURL(url)).toBe(true);
    });

    it('should reject URL without vote path', () => {
      const url = 'https://example.com/other?candidate_id=candidate-123';
      
      expect(URLUtils.isVotingURL(url)).toBe(false);
    });

    it('should reject URL without candidate_id parameter', () => {
      const url = 'https://example.com/vote?other_param=value';
      
      expect(URLUtils.isVotingURL(url)).toBe(false);
    });

    it('should reject invalid URL', () => {
      const invalidURL = 'not-a-url';
      
      expect(URLUtils.isVotingURL(invalidURL)).toBe(false);
    });
  });
});
describe('QRCodePresets', () => {
  it('should have all required presets', () => {
    expect(QRCodePresets.wechat).toBeDefined();
    expect(QRCodePresets.print).toBeDefined();
    expect(QRCodePresets.web).toBeDefined();
    expect(QRCodePresets.small).toBeDefined();
    expect(QRCodePresets.svg).toBeDefined();
  });

  it('should have WeChat preset optimized for mobile scanning', () => {
    const preset = QRCodePresets.wechat;
    expect(preset.format).toBe('png');
    expect(preset.size).toBe(256);
    expect(preset.errorCorrection).toBe('H');
    expect(preset.margin).toBe(2);
  });

  it('should have print preset with high resolution', () => {
    const preset = QRCodePresets.print;
    expect(preset.format).toBe('png');
    expect(preset.size).toBe(512);
    expect(preset.quality).toBe(1.0);
  });
});

describe('QRCodeHelpers', () => {
  let generator: VotingQRCodeURLGenerator;
  const candidateInfo: CandidateInfo = {
    id: 'candidate-123',
    name: '张三'
  };

  beforeEach(() => {
    generator = new VotingQRCodeURLGenerator('https://example.com');
  });

  describe('generateForWeChat', () => {
    it('should generate QR code optimized for WeChat', async () => {
      const qrCode = await QRCodeHelpers.generateForWeChat(generator, candidateInfo);
      
      expect(qrCode.format).toBe('png');
      expect(qrCode.size).toBe(256);
      expect(qrCode.imageData).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('generateForPrint', () => {
    it('should generate QR code optimized for printing', async () => {
      const qrCode = await QRCodeHelpers.generateForPrint(generator, candidateInfo);
      
      expect(qrCode.format).toBe('png');
      expect(qrCode.size).toBe(512);
      expect(qrCode.imageData).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('generateMultipleFormats', () => {
    it('should generate QR codes in multiple formats', async () => {
      const formats: (keyof typeof QRCodePresets)[] = ['wechat', 'web', 'print'];
      const qrCodes = await QRCodeHelpers.generateMultipleFormats(generator, candidateInfo, formats);
      
      expect(qrCodes).toHaveLength(3);
      expect(qrCodes[0].preset).toBe('wechat');
      expect(qrCodes[1].preset).toBe('web');
      expect(qrCodes[2].preset).toBe('print');
      
      // All should have the same URL but different sizes
      const url = qrCodes[0].url;
      expect(qrCodes.every(qr => qr.url === url)).toBe(true);
    });

    it('should use default formats when none specified', async () => {
      const qrCodes = await QRCodeHelpers.generateMultipleFormats(generator, candidateInfo);
      
      expect(qrCodes).toHaveLength(3);
      expect(qrCodes.map(qr => qr.preset)).toEqual(['wechat', 'web', 'print']);
    });
  });

  describe('validateOptions', () => {
    it('should validate correct options', () => {
      const options: QRCodeGenerationOptions = {
        format: 'png',
        size: 256,
        margin: 2,
        quality: 0.8,
        darkColor: '#000000',
        lightColor: '#FFFFFF'
      };

      const result = QRCodeHelpers.validateOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid size', () => {
      const options: QRCodeGenerationOptions = {
        size: 32 // Too small
      };

      const result = QRCodeHelpers.validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Size must be between 64 and 2048 pixels');
    });

    it('should reject invalid margin', () => {
      const options: QRCodeGenerationOptions = {
        margin: -1 // Negative margin
      };

      const result = QRCodeHelpers.validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Margin must be between 0 and 10 modules');
    });

    it('should reject invalid quality', () => {
      const options: QRCodeGenerationOptions = {
        quality: 1.5 // Greater than 1
      };

      const result = QRCodeHelpers.validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quality must be between 0 and 1');
    });

    it('should reject invalid color format', () => {
      const options: QRCodeGenerationOptions = {
        darkColor: 'invalid-color',
        lightColor: '#GGGGGG' // Invalid hex
      };

      const result = QRCodeHelpers.validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dark color must be a valid hex color (e.g., #000000)');
      expect(result.errors).toContain('Light color must be a valid hex color (e.g., #FFFFFF)');
    });

    it('should collect multiple validation errors', () => {
      const options: QRCodeGenerationOptions = {
        size: 32,
        margin: -1,
        quality: 2,
        darkColor: 'red'
      };

      const result = QRCodeHelpers.validateOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});