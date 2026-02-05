/**
 * Vote Page Router Implementation
 * Implements URL parameter parsing and validation for the voting page
 * Based on design document specifications for task 3.1
 */
import { VotePageRouter, VotePageParams, ValidationResult, VotePageComponent } from '../types/qr-code-voting';
/**
 * Implementation of Vote Page Router
 * Handles URL parameter parsing and validation for voting pages
 */
export declare class VotingPageRouter implements VotePageRouter {
    /**
     * Parse URL parameters into vote page parameters
     * Extracts and decodes URL parameters from voting URLs
     * @param url - URL to parse (can be full URL or just query string)
     * @returns Parsed vote page parameters
     */
    parseURLParams(url: string): VotePageParams;
    /**
     * Validate vote page parameters
     * Performs comprehensive validation of all parameters
     * @param params - Parameters to validate
     * @returns Validation result with errors and sanitized params
     */
    validateParams(params: VotePageParams): ValidationResult;
    /**
     * Render vote page component (placeholder implementation)
     * This would typically integrate with a frontend framework
     * @param params - Vote page parameters
     * @returns Vote page component
     */
    renderVotePage(params: VotePageParams): VotePageComponent;
    /**
     * Extract and sanitize a parameter from raw parameters
     * @param rawParams - Raw decoded parameters
     * @param paramName - Name of parameter to extract
     * @returns Sanitized parameter value or empty string
     */
    private extractAndSanitizeParam;
    /**
     * Parse URL parameters with enhanced error handling
     * Alternative parsing method with more detailed error information
     * @param url - URL to parse
     * @returns Parsing result with success status and parameters or errors
     */
    parseURLParamsWithErrors(url: string): {
        success: boolean;
        params?: VotePageParams;
        errors: string[];
    };
    /**
     * Validate and parse URL in one step
     * Convenience method that combines parsing and validation
     * @param url - URL to parse and validate
     * @returns Combined result with parsed and validated parameters
     */
    parseAndValidateURL(url: string): {
        parseSuccess: boolean;
        validationResult: ValidationResult;
        params?: VotePageParams;
        parseErrors: string[];
    };
    /**
     * Extract specific parameter from URL
     * Utility method to get a single parameter value
     * @param url - URL to parse
     * @param paramName - Name of parameter to extract
     * @returns Parameter value or null if not found
     */
    extractParameter(url: string, paramName: string): string | null;
    /**
     * Check if URL contains valid voting parameters
     * Quick validation method for URL screening
     * @param url - URL to check
     * @returns Whether URL appears to contain valid voting parameters
     */
    hasValidVotingParams(url: string): boolean;
    /**
     * Normalize URL parameters
     * Ensures consistent parameter format and encoding
     * @param params - Parameters to normalize
     * @returns Normalized parameters
     */
    normalizeParams(params: VotePageParams): VotePageParams;
    /**
     * Convert parameters back to URL query string
     * Utility method for reconstructing URLs
     * @param params - Parameters to convert
     * @returns URL query string
     */
    paramsToQueryString(params: VotePageParams): string;
    /**
     * Create a complete voting URL from parameters
     * @param params - Vote page parameters
     * @param baseURL - Base URL for the voting page
     * @returns Complete voting URL
     */
    createVotingURL(params: VotePageParams, baseURL?: string): string;
}
/**
 * Factory function to create a new Vote Page Router instance
 * @returns New VotePageRouter instance
 */
export declare function createVotePageRouter(): VotePageRouter;
/**
 * Utility functions for vote page routing
 */
export declare const VotePageRouterUtils: {
    /**
     * Quick parse and validate URL
     * @param url - URL to process
     * @returns Validation result with parsed parameters
     */
    quickValidate(url: string): ValidationResult & {
        params?: VotePageParams;
    };
    /**
     * Extract candidate information from URL
     * @param url - Voting URL
     * @returns Candidate information or null
     */
    extractCandidateInfo(url: string): {
        id: string;
        name: string;
        category?: string;
    } | null;
    /**
     * Check if URL is a valid voting URL
     * @param url - URL to check
     * @returns Whether URL is valid for voting
     */
    isValidVotingURL(url: string): boolean;
    /**
     * Sanitize voting URL parameters
     * @param url - URL to sanitize
     * @returns Sanitized URL or null if invalid
     */
    sanitizeVotingURL(url: string): string | null;
};
/**
 * Default export for convenience
 */
export default VotingPageRouter;
//# sourceMappingURL=vote-page-router.d.ts.map