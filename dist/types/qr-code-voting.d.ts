/**
 * Core TypeScript interfaces for QR Code Voting URL feature
 * Based on design document specifications
 */
/**
 * Candidate information for voting
 */
export interface CandidateInfo {
    /** Unique identifier for the candidate */
    id: string;
    /** Display name of the candidate */
    name: string;
    /** Optional voting category */
    category?: string;
    /** Additional metadata */
    metadata?: Record<string, any>;
}
/**
 * QR Code data structure
 */
export interface QRCodeData {
    /** Base64 encoded image data */
    imageData: string;
    /** The voting URL encoded in the QR code */
    url: string;
    /** Timestamp when QR code was generated */
    timestamp: Date;
    /** Image format used */
    format?: string;
    /** Image size in pixels */
    size?: number;
}
/**
 * QR Code buffer data structure for different output formats
 */
export interface QRCodeBufferData {
    /** Buffer containing the QR code image data */
    buffer: Buffer;
    /** The voting URL encoded in the QR code */
    url: string;
    /** Timestamp when QR code was generated */
    timestamp: Date;
    /** Image format */
    format: string;
    /** Image size in pixels */
    size: number;
    /** MIME type of the image */
    mimeType: string;
}
/**
 * QR Code generation options
 */
export interface QRCodeGenerationOptions {
    /** Image format: 'png', 'jpeg', 'webp', 'svg' */
    format?: 'png' | 'jpeg' | 'jpg' | 'webp' | 'svg';
    /** Image size in pixels (width and height) */
    size?: number;
    /** Margin around QR code (in modules) */
    margin?: number;
    /** Error correction level: 'L', 'M', 'Q', 'H' */
    errorCorrection?: 'L' | 'M' | 'Q' | 'H';
    /** Dark color (foreground) */
    darkColor?: string;
    /** Light color (background) */
    lightColor?: string;
    /** Image quality (0-1, for JPEG/WebP) */
    quality?: number;
}
/**
 * URL parameters for vote page
 */
export interface VotePageParams {
    /** Candidate unique identifier */
    candidateId: string;
    /** Candidate display name */
    candidateName: string;
    /** Optional voting category */
    category?: string;
    /** Source of the vote request */
    source: 'qrcode' | 'direct';
    /** Optional timestamp for validation */
    timestamp?: string;
}
/**
 * Validation result for URL parameters
 */
export interface ValidationResult {
    /** Whether the parameters are valid */
    isValid: boolean;
    /** List of validation errors */
    errors: string[];
    /** Sanitized parameters if validation passed */
    sanitizedParams?: VotePageParams;
}
/**
 * User authentication status
 */
export interface AuthStatus {
    /** Whether user is currently logged in */
    isLoggedIn: boolean;
    /** User information if logged in */
    user?: User;
    /** Session expiry date if applicable */
    sessionExpiry?: Date;
}
/**
 * User information
 */
export interface User {
    /** Unique user identifier */
    id: string;
    /** Username */
    username: string;
    /** User email address */
    email: string;
    /** Whether user has voting rights */
    hasVotingRights: boolean;
}
/**
 * Vote submission result
 */
export interface VoteResult {
    /** Whether the vote was successful */
    success: boolean;
    /** Result message */
    message: string;
    /** Vote ID if successful */
    voteId?: string;
    /** Timestamp of the vote */
    timestamp?: Date;
}
/**
 * QR Code URL Generator interface
 */
export interface QRCodeURLGenerator {
    /**
     * Generate voting URL from candidate information
     * @param candidateInfo - Candidate information
     * @returns Generated voting URL
     */
    generateVotingURL(candidateInfo: CandidateInfo): string;
    /**
     * Generate QR code from URL with customizable options
     * @param url - Voting URL
     * @param options - QR code generation options
     * @returns QR code data
     */
    generateQRCode(url: string, options?: QRCodeGenerationOptions): Promise<QRCodeData>;
    /**
     * Generate QR code as buffer for different output formats
     * @param url - Voting URL
     * @param options - QR code generation options
     * @returns QR code buffer data
     */
    generateQRCodeBuffer(url: string, options?: QRCodeGenerationOptions): Promise<QRCodeBufferData>;
    /**
     * Validate voting URL format
     * @param url - URL to validate
     * @returns Whether URL is valid
     */
    validateURL(url: string): boolean;
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
}
/**
 * Vote Page Router interface
 */
export interface VotePageRouter {
    /**
     * Parse URL parameters into vote page parameters
     * @param url - URL to parse
     * @returns Parsed parameters
     */
    parseURLParams(url: string): VotePageParams;
    /**
     * Validate vote page parameters
     * @param params - Parameters to validate
     * @returns Validation result
     */
    validateParams(params: VotePageParams): ValidationResult;
    /**
     * Render vote page component
     * @param params - Vote page parameters
     * @returns Vote page component
     */
    renderVotePage(params: VotePageParams): VotePageComponent;
}
/**
 * Authentication Guard interface
 */
export interface AuthenticationGuard {
    /**
     * Check current user login status
     * @returns Authentication status
     */
    checkLoginStatus(): Promise<AuthStatus>;
    /**
     * Require user authentication
     * @returns User if authenticated, null otherwise
     */
    requireAuthentication(): Promise<User | null>;
    /**
     * Redirect to login page
     * @param returnUrl - URL to return to after login
     */
    redirectToLogin(returnUrl: string): void;
    /**
     * Get current user without full authentication check
     * @returns Current user or null
     */
    getCurrentUser(): User | null;
}
/**
 * Vote Interface for handling voting operations
 */
export interface VoteInterface {
    /**
     * Display candidate information
     * @param candidate - Candidate to display
     */
    displayCandidate(candidate: CandidateInfo): void;
    /**
     * Submit a vote
     * @param candidateId - ID of candidate being voted for
     * @param userId - ID of user submitting vote
     * @returns Vote result
     */
    submitVote(candidateId: string, userId: string): Promise<VoteResult>;
    /**
     * Check if user has already voted for candidate
     * @param candidateId - Candidate ID
     * @param userId - User ID
     * @returns Whether vote exists
     */
    checkExistingVote(candidateId: string, userId: string): Promise<boolean>;
    /**
     * Show vote confirmation to user
     * @param result - Vote result to display
     */
    showVoteConfirmation(result: VoteResult): void;
}
/**
 * Vote Page Component interface
 */
export interface VotePageComponent {
    /** Component props */
    props: VotePageParams;
    /** Render method */
    render(): string | HTMLElement;
    /** Mount component */
    mount(container: HTMLElement): void;
    /** Unmount component */
    unmount(): void;
}
/**
 * URL parameter validation rules
 */
export declare const URL_VALIDATION_RULES: {
    /** Maximum length for candidate name */
    readonly MAX_CANDIDATE_NAME_LENGTH: 50;
    /** Minimum length for candidate name */
    readonly MIN_CANDIDATE_NAME_LENGTH: 1;
    /** Maximum age for timestamp in hours */
    readonly MAX_TIMESTAMP_AGE_HOURS: 24;
    /** Valid source values */
    readonly VALID_SOURCES: readonly ["qrcode", "direct"];
    /** Required URL parameters */
    readonly REQUIRED_PARAMS: readonly ["candidate_id", "candidate_name", "source"];
};
/**
 * Security validation patterns
 */
export declare const SECURITY_PATTERNS: {
    /** Pattern for valid candidate ID (alphanumeric and hyphens) */
    readonly CANDIDATE_ID_PATTERN: RegExp;
    /** Pattern for valid candidate name (letters, numbers, spaces, basic punctuation) */
    readonly CANDIDATE_NAME_PATTERN: RegExp;
    /** Pattern for valid category name */
    readonly CATEGORY_PATTERN: RegExp;
};
/**
 * Error message constants
 */
export declare const ERROR_MESSAGES: {
    readonly INVALID_CANDIDATE_ID: "Invalid candidate ID format";
    readonly INVALID_CANDIDATE_NAME: "Invalid candidate name format";
    readonly MISSING_REQUIRED_PARAM: "Missing required parameter";
    readonly EXPIRED_TIMESTAMP: "URL has expired";
    readonly INVALID_SOURCE: "Invalid source parameter";
    readonly CANDIDATE_NOT_FOUND: "Candidate not found";
    readonly AUTHENTICATION_REQUIRED: "Authentication required";
    readonly VOTING_PERMISSION_DENIED: "Voting permission denied";
    readonly DUPLICATE_VOTE: "Vote already exists for this candidate";
    readonly VOTE_SUBMISSION_FAILED: "Failed to submit vote";
};
/**
 * Type guard for CandidateInfo
 */
export declare function isCandidateInfo(obj: any): obj is CandidateInfo;
/**
 * Type guard for VotePageParams
 */
export declare function isVotePageParams(obj: any): obj is VotePageParams;
/**
 * Type guard for User
 */
export declare function isUser(obj: any): obj is User;
/**
 * Utility type for partial candidate info (for updates)
 */
export type PartialCandidateInfo = Partial<CandidateInfo> & Pick<CandidateInfo, 'id'>;
/**
 * Utility type for vote page params without optional fields
 */
export type RequiredVotePageParams = Required<Pick<VotePageParams, 'candidateId' | 'candidateName' | 'source'>>;
/**
 * Utility type for authentication result
 */
export type AuthResult = AuthStatus & {
    redirectUrl?: string;
};
//# sourceMappingURL=qr-code-voting.d.ts.map