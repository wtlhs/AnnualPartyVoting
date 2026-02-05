"use strict";
/**
 * QR Code URL Generator for Voting System
 * Implements the QRCodeURLGenerator interface to generate voting URLs from candidate information
 * Based on design document specifications
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLUtils = exports.QRCodeHelpers = exports.QRCodePresets = exports.VotingQRCodeURLGenerator = void 0;
exports.createQRCodeURLGenerator = createQRCodeURLGenerator;
const qr_code_voting_1 = require("../types/qr-code-voting");
/**
 * Implementation of QR Code URL Generator
 * Converts candidate information into voting URLs and generates QR codes
 */
class VotingQRCodeURLGenerator {
    constructor(baseURL = 'https://domain.com') {
        this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    }
    /**
     * Generate voting URL from candidate information
     * @param candidateInfo - Candidate information
     * @returns Generated voting URL with all required parameters
     */
    generateVotingURL(candidateInfo) {
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
    async generateQRCode(url, options) {
        if (!this.validateURL(url)) {
            throw new Error('Invalid URL provided for QR code generation');
        }
        try {
            // Import QRCode library dynamically to handle both CommonJS and ES modules
            const QRCode = await Promise.resolve().then(() => __importStar(require('qrcode')));
            // Merge default options with user-provided options
            const qrOptions = this.buildQRCodeOptions(options);
            // Use callback-based API wrapped in Promise
            const imageData = await new Promise((resolve, reject) => {
                QRCode.toDataURL(url, qrOptions, (err, dataUrl) => {
                    if (err)
                        reject(err);
                    else
                        resolve(dataUrl);
                });
            });
            return {
                imageData,
                url,
                timestamp: new Date(),
                format: options?.format || 'png',
                size: qrOptions.width || 256
            };
        }
        catch (error) {
            throw new Error(`QR code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate QR code as buffer for different output formats
     * @param url - Voting URL
     * @param options - QR code generation options
     * @returns Promise resolving to QR code buffer data
     */
    async generateQRCodeBuffer(url, options) {
        if (!this.validateURL(url)) {
            throw new Error('Invalid URL provided for QR code generation');
        }
        try {
            const QRCode = await Promise.resolve().then(() => __importStar(require('qrcode')));
            const qrOptions = this.buildQRCodeOptions(options);
            let buffer;
            const format = options?.format || 'png';
            if (format === 'svg') {
                const svgString = await new Promise((resolve, reject) => {
                    QRCode.toString(url, { ...qrOptions, type: 'svg' }, (err, svg) => {
                        if (err)
                            reject(err);
                        else
                            resolve(svg);
                    });
                });
                buffer = Buffer.from(svgString, 'utf8');
            }
            else {
                buffer = await new Promise((resolve, reject) => {
                    QRCode.toBuffer(url, qrOptions, (err, buf) => {
                        if (err)
                            reject(err);
                        else
                            resolve(buf);
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
        }
        catch (error) {
            throw new Error(`QR code buffer generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Validate voting URL format
     * @param url - URL to validate
     * @returns Whether URL is valid
     */
    validateURL(url) {
        try {
            const urlObj = new URL(url);
            // Check if it's a valid voting URL path
            if (!urlObj.pathname.endsWith('/vote')) {
                return false;
            }
            // Check required parameters
            const params = urlObj.searchParams;
            const requiredParams = qr_code_voting_1.URL_VALIDATION_RULES.REQUIRED_PARAMS;
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
            if (!candidateId || !qr_code_voting_1.SECURITY_PATTERNS.CANDIDATE_ID_PATTERN.test(candidateId)) {
                return false;
            }
            // Validate candidate name format and length
            if (!candidateName ||
                candidateName.length < qr_code_voting_1.URL_VALIDATION_RULES.MIN_CANDIDATE_NAME_LENGTH ||
                candidateName.length > qr_code_voting_1.URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH) {
                return false;
            }
            // Note: We don't validate candidate name pattern here because it may contain Unicode characters
            // that are properly encoded in the URL but valid when decoded
            // Validate source
            if (!source || !qr_code_voting_1.URL_VALIDATION_RULES.VALID_SOURCES.includes(source)) {
                return false;
            }
            // Validate timestamp if present
            if (timestamp && !this.validateTimestamp(timestamp)) {
                return false;
            }
            // Validate optional category if present
            const category = params.get('category');
            if (category && category.length > qr_code_voting_1.URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH) {
                return false;
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Validate candidate information
     * @param candidateInfo - Candidate information to validate
     * @throws Error if validation fails
     */
    validateCandidateInfo(candidateInfo) {
        if (!candidateInfo) {
            throw new Error('Candidate information is required');
        }
        if (!candidateInfo.id || typeof candidateInfo.id !== 'string') {
            throw new Error('Candidate ID is required and must be a string');
        }
        if (!qr_code_voting_1.SECURITY_PATTERNS.CANDIDATE_ID_PATTERN.test(candidateInfo.id)) {
            throw new Error('Candidate ID contains invalid characters');
        }
        if (!candidateInfo.name || typeof candidateInfo.name !== 'string') {
            throw new Error('Candidate name is required and must be a string');
        }
        if (candidateInfo.name.length < qr_code_voting_1.URL_VALIDATION_RULES.MIN_CANDIDATE_NAME_LENGTH ||
            candidateInfo.name.length > qr_code_voting_1.URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH) {
            throw new Error(`Candidate name must be between ${qr_code_voting_1.URL_VALIDATION_RULES.MIN_CANDIDATE_NAME_LENGTH} and ${qr_code_voting_1.URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH} characters`);
        }
        if (!qr_code_voting_1.SECURITY_PATTERNS.CANDIDATE_NAME_PATTERN.test(candidateInfo.name)) {
            throw new Error('Candidate name contains invalid characters');
        }
        if (candidateInfo.category && !qr_code_voting_1.SECURITY_PATTERNS.CATEGORY_PATTERN.test(candidateInfo.category)) {
            throw new Error('Category contains invalid characters');
        }
    }
    /**
     * Generate current timestamp for URL
     * @returns Unix timestamp
     */
    generateTimestamp() {
        return Math.floor(Date.now() / 1000);
    }
    /**
     * Validate timestamp for URL expiration
     * @param timestamp - Timestamp string to validate
     * @returns Whether timestamp is valid and not expired
     */
    validateTimestamp(timestamp) {
        const timestampNum = parseInt(timestamp, 10);
        if (isNaN(timestampNum) || timestampNum <= 0) {
            return false;
        }
        const now = Math.floor(Date.now() / 1000);
        const maxAge = qr_code_voting_1.URL_VALIDATION_RULES.MAX_TIMESTAMP_AGE_HOURS * 3600; // Convert hours to seconds
        return (now - timestampNum) <= maxAge;
    }
    /**
     * Encode URL parameter to prevent injection attacks
     * @param value - Parameter value to encode
     * @returns Encoded parameter value
     */
    encodeParameter(value) {
        // URLSearchParams.set() already handles encoding, so just trim and return
        return value.trim();
    }
    /**
     * Set base URL for voting links
     * @param baseURL - New base URL
     */
    setBaseURL(baseURL) {
        this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    }
    /**
     * Get current base URL
     * @returns Current base URL
     */
    getBaseURL() {
        return this.baseURL;
    }
    /**
     * Build QR code options with defaults optimized for WeChat scanning
     * @param userOptions - User-provided options
     * @returns Complete QR code options
     */
    buildQRCodeOptions(userOptions) {
        const defaultOptions = {
            // Use 'H' (High) error correction for better scanning reliability in WeChat
            errorCorrectionLevel: 'H',
            type: 'image/png',
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
        let type = defaultOptions.type;
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
    getMimeType(format) {
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
exports.VotingQRCodeURLGenerator = VotingQRCodeURLGenerator;
/**
 * Factory function to create a new QR Code URL Generator instance
 * @param baseURL - Base URL for voting links
 * @returns New QRCodeURLGenerator instance
 */
function createQRCodeURLGenerator(baseURL) {
    return new VotingQRCodeURLGenerator(baseURL);
}
/**
 * Predefined QR code generation presets optimized for different use cases
 */
exports.QRCodePresets = {
    /**
     * WeChat optimized preset - High error correction, good size for mobile
     */
    wechat: {
        format: 'png',
        size: 256,
        margin: 2,
        errorCorrection: 'H',
        darkColor: '#000000',
        lightColor: '#FFFFFF',
        quality: 0.92
    },
    /**
     * Print optimized preset - High resolution, high error correction
     */
    print: {
        format: 'png',
        size: 512,
        margin: 4,
        errorCorrection: 'H',
        darkColor: '#000000',
        lightColor: '#FFFFFF',
        quality: 1.0
    },
    /**
     * Web optimized preset - Balanced size and quality
     */
    web: {
        format: 'png',
        size: 200,
        margin: 1,
        errorCorrection: 'M',
        darkColor: '#000000',
        lightColor: '#FFFFFF',
        quality: 0.8
    },
    /**
     * Small size preset - For thumbnails or limited space
     */
    small: {
        format: 'png',
        size: 128,
        margin: 1,
        errorCorrection: 'M',
        darkColor: '#000000',
        lightColor: '#FFFFFF',
        quality: 0.8
    },
    /**
     * SVG preset - Vector format for scalability
     */
    svg: {
        format: 'svg',
        size: 256,
        margin: 2,
        errorCorrection: 'H',
        darkColor: '#000000',
        lightColor: '#FFFFFF'
    }
};
/**
 * Helper functions for common QR code operations
 */
exports.QRCodeHelpers = {
    /**
     * Generate QR code optimized for WeChat scanning
     * @param generator - QR code generator instance
     * @param candidateInfo - Candidate information
     * @returns Promise resolving to WeChat-optimized QR code
     */
    async generateForWeChat(generator, candidateInfo) {
        const url = generator.generateVotingURL(candidateInfo);
        return generator.generateQRCode(url, exports.QRCodePresets.wechat);
    },
    /**
     * Generate QR code for printing
     * @param generator - QR code generator instance
     * @param candidateInfo - Candidate information
     * @returns Promise resolving to print-optimized QR code
     */
    async generateForPrint(generator, candidateInfo) {
        const url = generator.generateVotingURL(candidateInfo);
        return generator.generateQRCode(url, exports.QRCodePresets.print);
    },
    /**
     * Generate multiple QR code formats for the same candidate
     * @param generator - QR code generator instance
     * @param candidateInfo - Candidate information
     * @param formats - Array of format presets to generate
     * @returns Promise resolving to array of QR codes in different formats
     */
    async generateMultipleFormats(generator, candidateInfo, formats = ['wechat', 'web', 'print']) {
        const url = generator.generateVotingURL(candidateInfo);
        const results = await Promise.all(formats.map(async (preset) => {
            const qrCode = await generator.generateQRCode(url, exports.QRCodePresets[preset]);
            return { ...qrCode, preset };
        }));
        return results;
    },
    /**
     * Validate QR code generation options
     * @param options - Options to validate
     * @returns Validation result with errors if any
     */
    validateOptions(options) {
        const errors = [];
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
exports.URLUtils = {
    /**
     * Parse voting URL parameters
     * @param url - URL to parse
     * @returns Parsed parameters or null if invalid
     */
    parseVotingURL(url) {
        try {
            const urlObj = new URL(url);
            const params = {};
            urlObj.searchParams.forEach((value, key) => {
                params[key] = decodeURIComponent(value);
            });
            return params;
        }
        catch (error) {
            return null;
        }
    },
    /**
     * Extract candidate ID from voting URL
     * @param url - Voting URL
     * @returns Candidate ID or null if not found
     */
    extractCandidateId(url) {
        const params = this.parseVotingURL(url);
        return params?.candidate_id || null;
    },
    /**
     * Check if URL is a voting URL
     * @param url - URL to check
     * @returns Whether URL is a voting URL
     */
    isVotingURL(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.endsWith('/vote') && urlObj.searchParams.has('candidate_id');
        }
        catch (error) {
            return false;
        }
    }
};
//# sourceMappingURL=qr-code-url-generator.js.map