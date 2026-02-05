/**
 * QR Code URL Generator for Voting System
 * Implements the QRCodeURLGenerator interface to generate voting URLs from candidate information
 * Based on design document specifications
 */
import { QRCodeURLGenerator, CandidateInfo, QRCodeData, QRCodeBufferData, QRCodeGenerationOptions } from '../types/qr-code-voting';
/**
 * Implementation of QR Code URL Generator
 * Converts candidate information into voting URLs and generates QR codes
 */
export declare class VotingQRCodeURLGenerator implements QRCodeURLGenerator {
    private baseURL;
    constructor(baseURL?: string);
    /**
     * Generate voting URL from candidate information
     * @param candidateInfo - Candidate information
     * @returns Generated voting URL with all required parameters
     */
    generateVotingURL(candidateInfo: CandidateInfo): string;
    /**
     * Generate QR code from URL with customizable options
     * @param url - Voting URL
     * @param options - QR code generation options
     * @returns Promise resolving to QR code data
     */
    generateQRCode(url: string, options?: QRCodeGenerationOptions): Promise<QRCodeData>;
    /**
     * Generate QR code as buffer for different output formats
     * @param url - Voting URL
     * @param options - QR code generation options
     * @returns Promise resolving to QR code buffer data
     */
    generateQRCodeBuffer(url: string, options?: QRCodeGenerationOptions): Promise<QRCodeBufferData>;
    /**
     * Validate voting URL format
     * @param url - URL to validate
     * @returns Whether URL is valid
     */
    validateURL(url: string): boolean;
    /**
     * Validate candidate information
     * @param candidateInfo - Candidate information to validate
     * @throws Error if validation fails
     */
    private validateCandidateInfo;
    /**
     * Generate current timestamp for URL
     * @returns Unix timestamp
     */
    private generateTimestamp;
    /**
     * Validate timestamp for URL expiration
     * @param timestamp - Timestamp string to validate
     * @returns Whether timestamp is valid and not expired
     */
    private validateTimestamp;
    /**
     * Encode URL parameter to prevent injection attacks
     * @param value - Parameter value to encode
     * @returns Encoded parameter value
     */
    private encodeParameter;
    /**
     * Set base URL for voting links
     * @param baseURL - New base URL
     */
    setBaseURL(baseURL: string): void;
    /**
     * Get current base URL
     * @returns Current base URL
     */
    getBaseURL(): string;
    /**
     * Build QR code options with defaults optimized for WeChat scanning
     * @param userOptions - User-provided options
     * @returns Complete QR code options
     */
    private buildQRCodeOptions;
    /**
     * Get MIME type for image format
     * @param format - Image format
     * @returns MIME type string
     */
    private getMimeType;
}
/**
 * Factory function to create a new QR Code URL Generator instance
 * @param baseURL - Base URL for voting links
 * @returns New QRCodeURLGenerator instance
 */
export declare function createQRCodeURLGenerator(baseURL?: string): QRCodeURLGenerator;
/**
 * Predefined QR code generation presets optimized for different use cases
 */
export declare const QRCodePresets: {
    /**
     * WeChat optimized preset - High error correction, good size for mobile
     */
    readonly wechat: {
        readonly format: "png";
        readonly size: 256;
        readonly margin: 2;
        readonly errorCorrection: "H";
        readonly darkColor: "#000000";
        readonly lightColor: "#FFFFFF";
        readonly quality: 0.92;
    };
    /**
     * Print optimized preset - High resolution, high error correction
     */
    readonly print: {
        readonly format: "png";
        readonly size: 512;
        readonly margin: 4;
        readonly errorCorrection: "H";
        readonly darkColor: "#000000";
        readonly lightColor: "#FFFFFF";
        readonly quality: 1;
    };
    /**
     * Web optimized preset - Balanced size and quality
     */
    readonly web: {
        readonly format: "png";
        readonly size: 200;
        readonly margin: 1;
        readonly errorCorrection: "M";
        readonly darkColor: "#000000";
        readonly lightColor: "#FFFFFF";
        readonly quality: 0.8;
    };
    /**
     * Small size preset - For thumbnails or limited space
     */
    readonly small: {
        readonly format: "png";
        readonly size: 128;
        readonly margin: 1;
        readonly errorCorrection: "M";
        readonly darkColor: "#000000";
        readonly lightColor: "#FFFFFF";
        readonly quality: 0.8;
    };
    /**
     * SVG preset - Vector format for scalability
     */
    readonly svg: {
        readonly format: "svg";
        readonly size: 256;
        readonly margin: 2;
        readonly errorCorrection: "H";
        readonly darkColor: "#000000";
        readonly lightColor: "#FFFFFF";
    };
};
/**
 * Helper functions for common QR code operations
 */
export declare const QRCodeHelpers: {
    /**
     * Generate QR code optimized for WeChat scanning
     * @param generator - QR code generator instance
     * @param candidateInfo - Candidate information
     * @returns Promise resolving to WeChat-optimized QR code
     */
    generateForWeChat(generator: QRCodeURLGenerator, candidateInfo: CandidateInfo): Promise<QRCodeData>;
    /**
     * Generate QR code for printing
     * @param generator - QR code generator instance
     * @param candidateInfo - Candidate information
     * @returns Promise resolving to print-optimized QR code
     */
    generateForPrint(generator: QRCodeURLGenerator, candidateInfo: CandidateInfo): Promise<QRCodeData>;
    /**
     * Generate multiple QR code formats for the same candidate
     * @param generator - QR code generator instance
     * @param candidateInfo - Candidate information
     * @param formats - Array of format presets to generate
     * @returns Promise resolving to array of QR codes in different formats
     */
    generateMultipleFormats(generator: QRCodeURLGenerator, candidateInfo: CandidateInfo, formats?: (keyof typeof QRCodePresets)[]): Promise<Array<QRCodeData & {
        preset: string;
    }>>;
    /**
     * Validate QR code generation options
     * @param options - Options to validate
     * @returns Validation result with errors if any
     */
    validateOptions(options: QRCodeGenerationOptions): {
        isValid: boolean;
        errors: string[];
    };
};
/**
 * Utility functions for URL parameter handling
 */
export declare const URLUtils: {
    /**
     * Parse voting URL parameters
     * @param url - URL to parse
     * @returns Parsed parameters or null if invalid
     */
    parseVotingURL(url: string): Record<string, string> | null;
    /**
     * Extract candidate ID from voting URL
     * @param url - Voting URL
     * @returns Candidate ID or null if not found
     */
    extractCandidateId(url: string): string | null;
    /**
     * Check if URL is a voting URL
     * @param url - URL to check
     * @returns Whether URL is a voting URL
     */
    isVotingURL(url: string): boolean;
};
//# sourceMappingURL=qr-code-url-generator.d.ts.map