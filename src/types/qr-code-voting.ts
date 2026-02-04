/**
 * Core TypeScript interfaces for QR Code Voting URL feature
 * Based on design document specifications
 */

// ============================================================================
// Core Data Types
// ============================================================================

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

// ============================================================================
// Component Interfaces
// ============================================================================

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

// ============================================================================
// Validation Rules and Constants
// ============================================================================

/**
 * URL parameter validation rules
 */
export const URL_VALIDATION_RULES = {
  /** Maximum length for candidate name */
  MAX_CANDIDATE_NAME_LENGTH: 50,
  /** Minimum length for candidate name */
  MIN_CANDIDATE_NAME_LENGTH: 1,
  /** Maximum age for timestamp in hours */
  MAX_TIMESTAMP_AGE_HOURS: 24,
  /** Valid source values */
  VALID_SOURCES: ['qrcode', 'direct'] as const,
  /** Required URL parameters */
  REQUIRED_PARAMS: ['candidate_id', 'candidate_name', 'source'] as const,
} as const;

/**
 * Security validation patterns
 */
export const SECURITY_PATTERNS = {
  /** Pattern for valid candidate ID (alphanumeric and hyphens) */
  CANDIDATE_ID_PATTERN: /^[a-zA-Z0-9\-_]+$/,
  /** Pattern for valid candidate name (letters, numbers, spaces, basic punctuation) */
  CANDIDATE_NAME_PATTERN: /^[a-zA-Z0-9\s\u4e00-\u9fff\-_.()]+$/,
  /** Pattern for valid category name */
  CATEGORY_PATTERN: /^[a-zA-Z0-9\s\u4e00-\u9fff\-_.()]+$/,
} as const;

/**
 * Error message constants
 */
export const ERROR_MESSAGES = {
  INVALID_CANDIDATE_ID: 'Invalid candidate ID format',
  INVALID_CANDIDATE_NAME: 'Invalid candidate name format',
  MISSING_REQUIRED_PARAM: 'Missing required parameter',
  EXPIRED_TIMESTAMP: 'URL has expired',
  INVALID_SOURCE: 'Invalid source parameter',
  CANDIDATE_NOT_FOUND: 'Candidate not found',
  AUTHENTICATION_REQUIRED: 'Authentication required',
  VOTING_PERMISSION_DENIED: 'Voting permission denied',
  DUPLICATE_VOTE: 'Vote already exists for this candidate',
  VOTE_SUBMISSION_FAILED: 'Failed to submit vote',
} as const;

// ============================================================================
// Type Guards and Utility Types
// ============================================================================

/**
 * Type guard for CandidateInfo
 */
export function isCandidateInfo(obj: any): obj is CandidateInfo {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.category === undefined || typeof obj.category === 'string')
  );
}

/**
 * Type guard for VotePageParams
 */
export function isVotePageParams(obj: any): obj is VotePageParams {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.candidateId === 'string' &&
    typeof obj.candidateName === 'string' &&
    (obj.source === 'qrcode' || obj.source === 'direct') &&
    (obj.category === undefined || typeof obj.category === 'string') &&
    (obj.timestamp === undefined || typeof obj.timestamp === 'string')
  );
}

/**
 * Type guard for User
 */
export function isUser(obj: any): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.username === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.hasVotingRights === 'boolean'
  );
}

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