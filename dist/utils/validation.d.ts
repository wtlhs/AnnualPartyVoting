/**
 * Validation utilities for QR Code Voting URL feature
 * Implements security and data validation rules from design document
 */
import { ValidationResult } from '../types/qr-code-voting';
/**
 * Validate candidate ID format and security
 * @param candidateId - Candidate ID to validate
 * @returns Whether candidate ID is valid
 */
export declare function validateCandidateId(candidateId: string): boolean;
/**
 * Validate candidate name format and length
 * @param candidateName - Candidate name to validate
 * @returns Whether candidate name is valid
 */
export declare function validateCandidateName(candidateName: string): boolean;
/**
 * Validate category format if provided
 * @param category - Category to validate
 * @returns Whether category is valid
 */
export declare function validateCategory(category?: string): boolean;
/**
 * Validate source parameter
 * @param source - Source to validate
 * @returns Whether source is valid
 */
export declare function validateSource(source: string): boolean;
/**
 * Validate timestamp parameter
 * @param timestamp - Timestamp string to validate
 * @returns Whether timestamp is valid and not expired
 */
export declare function validateTimestamp(timestamp?: string): boolean;
/**
 * Validate complete vote page parameters
 * @param params - Parameters to validate
 * @returns Validation result with errors and sanitized params
 */
export declare function validateVotePageParams(params: any): ValidationResult;
/**
 * Validate candidate information
 * @param candidateInfo - Candidate info to validate
 * @returns Validation result
 */
export declare function validateCandidateInfo(candidateInfo: any): ValidationResult;
/**
 * Sanitize string input to prevent injection attacks
 * @param input - Input string to sanitize
 * @returns Sanitized string
 */
export declare function sanitizeInput(input: string): string;
/**
 * Encode URL parameters safely
 * @param params - Parameters to encode
 * @returns Encoded parameter string
 */
export declare function encodeURLParams(params: Record<string, string>): string;
/**
 * Decode URL parameters safely
 * @param paramString - Parameter string to decode
 * @returns Decoded parameters object
 */
export declare function decodeURLParams(paramString: string): Record<string, string>;
/**
 * Generate secure timestamp for URL validation
 * @returns Unix timestamp as string
 */
export declare function generateTimestamp(): string;
/**
 * Check if URL is from a trusted domain (for security)
 * @param url - URL to check
 * @param trustedDomains - List of trusted domains
 * @returns Whether URL is from trusted domain
 */
export declare function isFromTrustedDomain(url: string, trustedDomains: string[]): boolean;
/**
 * Create standardized validation error
 * @param field - Field that failed validation
 * @param message - Error message
 * @returns Formatted error message
 */
export declare function createValidationError(field: string, message: string): string;
/**
 * Check if validation result has specific error
 * @param result - Validation result
 * @param errorMessage - Error message to check for
 * @returns Whether error exists
 */
export declare function hasValidationError(result: ValidationResult, errorMessage: string): boolean;
/**
 * Combine multiple validation results
 * @param results - Array of validation results
 * @returns Combined validation result
 */
export declare function combineValidationResults(results: ValidationResult[]): ValidationResult;
//# sourceMappingURL=validation.d.ts.map