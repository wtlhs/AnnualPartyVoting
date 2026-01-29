/**
 * QR Code URL Generator for Voting System
 * Implements the QRCodeURLGenerator interface to generate voting URLs from candidate information
 * Based on design document specifications
 */

import { 
  QRCodeURLGenerator, 
  CandidateInfo, 
  QRCodeData,
  QRCodeBufferData,
  QRCodeGenerationOptions,
  URL_VALIDATION_RULES,
  SECURITY_PATTERNS 
} from '../types/qr-code-voting';

/**
 * Implementation of QR Code URL Generator
 * Converts candidate information into voting URLs and generates QR codes
 */
export class VotingQRCodeURLGenerator implements QRCodeURLGenerator {
  private baseURL: string;
  
  constructor(baseURL: string = 'https://domain.com') {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generate voting URL from candidate information
   * @param candidateInfo - Candidate information
   * @returns Generated voting URL with all required parameters
   */
  generateVotingURL(candidateInfo: CandidateInfo): string {
    // Validate input
    this.validateCandidateInfo(candidateInfo);
    
    // Generate timestamp
    const timestamp = this.generateTimestamp();
    
    // Encode URL parameters
    const params = new URLSearchParams();
    params.set('candidate_id', this.encodeParameter(candidateInfo.id));
    params.set('candidate_name', this.encodeParameter(candidateInfo.name));
    params.set('source', 'qrcode');
    params.set('timestamp', timestamp.toString());
    
    // Add optional category if provided
    if (candidateInfo.category) {
      params.set('category', this.encodeParameter(candidateInfo.category));
    }
    
    // Construct full URL
    const votingURL = `${this.baseURL}/vote?${params.toString()}`;
    
    return votingURL;
  }

  /**
   * Generate QR code from URL with customizable options
   * @param url - Voting URL
   * @param options - QR code generation options
   * @returns Promise resolving to QR code data
   */
  async generateQRCode(url: string, options?: QRCodeGenerationOptions): Promise<QRCodeData> {
    if (!this.validateURL(url)) {
      throw new Error('Invalid URL provided for QR code generation');
    }

    try {
      // Import QRCode library dynamically to handle both CommonJS and ES modules
      const QRCode = await import('qrcode');
      
      // Merge default options with user-provided options
      const qrOptions = this.buildQRCodeOptions(options);

      // Use callback-based API wrapped in Promise
      const imageData = await new Promise<string>((resolve, reject) => {
        QRCode.toDataURL(url, qrOptions, (err: any, dataUrl: string) => {
          if (err) reject(err);
          else resolve(dataUrl);
        });
      });
      
      return {
        imageData,
        url,
        timestamp: new Date(),
        format: options?.format || 'png',
        size: qrOptions.width || 256
      };
    } catch (error) {
      throw new Error(`QR code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate QR code as buffer for different output formats
   * @param url - Voting URL
   * @param options - QR code generation options
   * @returns Promise resolving to QR code buffer data
   */
  async generateQRCodeBuffer(url: string, options?: QRCodeGenerationOptions): Promise<QRCodeBufferData> {
    if (!this.validateURL(url)) {
      throw new Error('Invalid URL provided for QR code generation');
    }

    try {
      const QRCode = await import('qrcode');
      const qrOptions = this.buildQRCodeOptions(options);
      
      let buffer: Buffer;
      const format = options?.format || 'png';
      
      if (format === 'svg') {
        const svgString = await new Promise<string>((resolve, reject) => {
          QRCode.toString(url, { ...qrOptions, type: 'svg' }, (err: any, svg: string) => {
            if (err) reject(err);
            else resolve(svg);
          });
        });
        buffer = Buffer.from(svgString, 'utf8');
      } else {
        buffer = await new Promise<Buffer>((resolve, reject) => {
          QRCode.toBuffer(url, qrOptions, (err: any, buf: Buffer) => {
            if (err) reject(err);
            else resolve(buf);
          });
        });
      }
      
      return {
        buffer,
        url,
        timestamp: new Date(),
        format,
        size: qrOptions.width || 256,
        mimeType: this.getMimeType(format)
      };
    } catch (error) {
      throw new Error(`QR code buffer generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate voting URL format
   * @param url - URL to validate
   * @returns Whether URL is valid
   */
  validateURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Check if it's a valid voting URL path
      if (!urlObj.pathname.endsWith('/vote')) {
        return false;
      }
      
      // Check required parameters
      const params = urlObj.searchParams;
      const requiredParams = URL_VALIDATION_RULES.REQUIRED_PARAMS;
      
      for (const param of requiredParams) {
        if (!params.has(param)) {
          return false;
        }
      }
      
      // Validate parameter values
      const candidateId = params.get('candidate_id');
      const candidateName = params.get('candidate_name');
      const source = params.get('source');
      const timestamp = params.get('timestamp');
      
      // Validate candidate ID format
      if (!candidateId || !SECURITY_PATTERNS.CANDIDATE_ID_PATTERN.test(candidateId)) {
        return false;
      }
      
      // Validate candidate name format and length
      if (!candidateName || 
          candidateName.length < URL_VALIDATION_RULES.MIN_CANDIDATE_NAME_LENGTH ||
          candidateName.length > URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH) {
        return false;
      }
      
      // Note: We don't validate candidate name pattern here because it may contain Unicode characters
      // that are properly encoded in the URL but valid when decoded
      
      // Validate source
      if (!source || !URL_VALIDATION_RULES.VALID_SOURCES.includes(source as any)) {
        return false;
      }
      
      // Validate timestamp if present
      if (timestamp && !this.validateTimestamp(timestamp)) {
        return false;
      }
      
      // Validate optional category if present
      const category = params.get('category');
      if (category && category.length > URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate candidate information
   * @param candidateInfo - Candidate information to validate
   * @throws Error if validation fails
   */
  private validateCandidateInfo(candidateInfo: CandidateInfo): void {
    if (!candidateInfo) {
      throw new Error('Candidate information is required');
    }
    
    if (!candidateInfo.id || typeof candidateInfo.id !== 'string') {
      throw new Error('Candidate ID is required and must be a string');
    }
    
    if (!SECURITY_PATTERNS.CANDIDATE_ID_PATTERN.test(candidateInfo.id)) {
      throw new Error('Candidate ID contains invalid characters');
    }
    
    if (!candidateInfo.name || typeof candidateInfo.name !== 'string') {
      throw new Error('Candidate name is required and must be a string');
    }
    
    if (candidateInfo.name.length < URL_VALIDATION_RULES.MIN_CANDIDATE_NAME_LENGTH ||
        candidateInfo.name.length > URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH) {
      throw new Error(`Candidate name must be between ${URL_VALIDATION_RULES.MIN_CANDIDATE_NAME_LENGTH} and ${URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH} characters`);
    }
    
    if (!SECURITY_PATTERNS.CANDIDATE_NAME_PATTERN.test(candidateInfo.name)) {
      throw new Error('Candidate name contains invalid characters');
    }
    
    if (candidateInfo.category && !SECURITY_PATTERNS.CATEGORY_PATTERN.test(candidateInfo.category)) {
      throw new Error('Category contains invalid characters');
    }
  }

  /**
   * Generate current timestamp for URL
   * @returns Unix timestamp
   */
  private generateTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Validate timestamp for URL expiration
   * @param timestamp - Timestamp string to validate
   * @returns Whether timestamp is valid and not expired
   */
  private validateTimestamp(timestamp: string): boolean {
    const timestampNum = parseInt(timestamp, 10);
    
    if (isNaN(timestampNum) || timestampNum <= 0) {
      return false;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const maxAge = URL_VALIDATION_RULES.MAX_TIMESTAMP_AGE_HOURS * 3600; // Convert hours to seconds
    
    return (now - timestampNum) <= maxAge;
  }

  /**
   * Encode URL parameter to prevent injection attacks
   * @param value - Parameter value to encode
   * @returns Encoded parameter value
   */
  private encodeParameter(value: string): string {
    // URLSearchParams.set() already handles encoding, so just trim and return
    return value.trim();
  }

  /**
   * Set base URL for voting links
   * @param baseURL - New base URL
   */
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Get current base URL
   * @returns Current base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Build QR code options with defaults optimized for WeChat scanning
   * @param userOptions - User-provided options
   * @returns Complete QR code options
   */
  private buildQRCodeOptions(userOptions?: QRCodeGenerationOptions): any {
    const defaultOptions = {
      // Use 'H' (High) error correction for better scanning reliability in WeChat
      errorCorrectionLevel: 'H' as const,
      type: 'image/png' as const,
      quality: 0.92,
      margin: 2, // Increased margin for better WeChat recognition
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256 // Default size suitable for mobile screens
    };

    if (!userOptions) {
      return defaultOptions;
    }

    // Map user-friendly format to QRCode library type
    let type: any = defaultOptions.type;
    if (userOptions.format) {
      switch (userOptions.format.toLowerCase()) {
        case 'png':
          type = 'image/png';
          break;
        case 'jpeg':
        case 'jpg':
          type = 'image/jpeg';
          break;
        case 'webp':
          type = 'image/webp';
          break;
        case 'svg':
          type = 'svg';
          break;
        default:
          type = 'image/png';
      }
    }

    return {
      ...defaultOptions,
      type,
      width: userOptions.size || defaultOptions.width,
      margin: userOptions.margin !== undefined ? userOptions.margin : defaultOptions.margin,
      errorCorrectionLevel: userOptions.errorCorrection || defaultOptions.errorCorrectionLevel,
      color: {
        dark: userOptions.darkColor || defaultOptions.color.dark,
        light: userOptions.lightColor || defaultOptions.color.light
      },
      quality: userOptions.quality !== undefined ? userOptions.quality : defaultOptions.quality
    };
  }

  /**
   * Get MIME type for image format
   * @param format - Image format
   * @returns MIME type string
   */
  private getMimeType(format: string): string {
    switch (format.toLowerCase()) {
      case 'png':
        return 'image/png';
      case 'jpeg':
      case 'jpg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'image/png';
    }
  }
}

/**
 * Factory function to create a new QR Code URL Generator instance
 * @param baseURL - Base URL for voting links
 * @returns New QRCodeURLGenerator instance
 */
export function createQRCodeURLGenerator(baseURL?: string): QRCodeURLGenerator {
  return new VotingQRCodeURLGenerator(baseURL);
}

/**
 * Predefined QR code generation presets optimized for different use cases
 */
export const QRCodePresets = {
  /**
   * WeChat optimized preset - High error correction, good size for mobile
   */
  wechat: {
    format: 'png' as const,
    size: 256,
    margin: 2,
    errorCorrection: 'H' as const,
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    quality: 0.92
  },

  /**
   * Print optimized preset - High resolution, high error correction
   */
  print: {
    format: 'png' as const,
    size: 512,
    margin: 4,
    errorCorrection: 'H' as const,
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    quality: 1.0
  },

  /**
   * Web optimized preset - Balanced size and quality
   */
  web: {
    format: 'png' as const,
    size: 200,
    margin: 1,
    errorCorrection: 'M' as const,
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    quality: 0.8
  },

  /**
   * Small size preset - For thumbnails or limited space
   */
  small: {
    format: 'png' as const,
    size: 128,
    margin: 1,
    errorCorrection: 'M' as const,
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    quality: 0.8
  },

  /**
   * SVG preset - Vector format for scalability
   */
  svg: {
    format: 'svg' as const,
    size: 256,
    margin: 2,
    errorCorrection: 'H' as const,
    darkColor: '#000000',
    lightColor: '#FFFFFF'
  }
} as const;

/**
 * Helper functions for common QR code operations
 */
export const QRCodeHelpers = {
  /**
   * Generate QR code optimized for WeChat scanning
   * @param generator - QR code generator instance
   * @param candidateInfo - Candidate information
   * @returns Promise resolving to WeChat-optimized QR code
   */
  async generateForWeChat(generator: QRCodeURLGenerator, candidateInfo: CandidateInfo): Promise<QRCodeData> {
    const url = generator.generateVotingURL(candidateInfo);
    return generator.generateQRCode(url, QRCodePresets.wechat);
  },

  /**
   * Generate QR code for printing
   * @param generator - QR code generator instance
   * @param candidateInfo - Candidate information
   * @returns Promise resolving to print-optimized QR code
   */
  async generateForPrint(generator: QRCodeURLGenerator, candidateInfo: CandidateInfo): Promise<QRCodeData> {
    const url = generator.generateVotingURL(candidateInfo);
    return generator.generateQRCode(url, QRCodePresets.print);
  },

  /**
   * Generate multiple QR code formats for the same candidate
   * @param generator - QR code generator instance
   * @param candidateInfo - Candidate information
   * @param formats - Array of format presets to generate
   * @returns Promise resolving to array of QR codes in different formats
   */
  async generateMultipleFormats(
    generator: QRCodeURLGenerator, 
    candidateInfo: CandidateInfo, 
    formats: (keyof typeof QRCodePresets)[] = ['wechat', 'web', 'print']
  ): Promise<Array<QRCodeData & { preset: string }>> {
    const url = generator.generateVotingURL(candidateInfo);
    const results = await Promise.all(
      formats.map(async (preset) => {
        const qrCode = await generator.generateQRCode(url, QRCodePresets[preset]);
        return { ...qrCode, preset };
      })
    );
    return results;
  },

  /**
   * Validate QR code generation options
   * @param options - Options to validate
   * @returns Validation result with errors if any
   */
  validateOptions(options: QRCodeGenerationOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (options.size !== undefined) {
      if (options.size < 64 || options.size > 2048) {
        errors.push('Size must be between 64 and 2048 pixels');
      }
    }

    if (options.margin !== undefined) {
      if (options.margin < 0 || options.margin > 10) {
        errors.push('Margin must be between 0 and 10 modules');
      }
    }

    if (options.quality !== undefined) {
      if (options.quality < 0 || options.quality > 1) {
        errors.push('Quality must be between 0 and 1');
      }
    }

    if (options.darkColor && !/^#[0-9A-Fa-f]{6}$/.test(options.darkColor)) {
      errors.push('Dark color must be a valid hex color (e.g., #000000)');
    }

    if (options.lightColor && !/^#[0-9A-Fa-f]{6}$/.test(options.lightColor)) {
      errors.push('Light color must be a valid hex color (e.g., #FFFFFF)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

/**
 * Utility functions for URL parameter handling
 */
export const URLUtils = {
  /**
   * Parse voting URL parameters
   * @param url - URL to parse
   * @returns Parsed parameters or null if invalid
   */
  parseVotingURL(url: string): Record<string, string> | null {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      
      urlObj.searchParams.forEach((value, key) => {
        params[key] = decodeURIComponent(value);
      });
      
      return params;
    } catch (error) {
      return null;
    }
  },

  /**
   * Extract candidate ID from voting URL
   * @param url - Voting URL
   * @returns Candidate ID or null if not found
   */
  extractCandidateId(url: string): string | null {
    const params = this.parseVotingURL(url);
    return params?.candidate_id || null;
  },

  /**
   * Check if URL is a voting URL
   * @param url - URL to check
   * @returns Whether URL is a voting URL
   */
  isVotingURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.endsWith('/vote') && urlObj.searchParams.has('candidate_id');
    } catch (error) {
      return false;
    }
  }
};