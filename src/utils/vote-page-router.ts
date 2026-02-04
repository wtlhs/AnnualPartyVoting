/**
 * Vote Page Router Implementation
 * Implements URL parameter parsing and validation for the voting page
 * Based on design document specifications for task 3.1
 */

import {
  VotePageRouter,
  VotePageParams,
  ValidationResult,
  VotePageComponent,
  URL_VALIDATION_RULES
} from '../types/qr-code-voting';

import {
  validateVotePageParams,
  decodeURLParams,
  sanitizeInput
} from './validation';

/**
 * Implementation of Vote Page Router
 * Handles URL parameter parsing and validation for voting pages
 */
export class VotingPageRouter implements VotePageRouter {
  
  /**
   * Parse URL parameters into vote page parameters
   * Extracts and decodes URL parameters from voting URLs
   * @param url - URL to parse (can be full URL or just query string)
   * @returns Parsed vote page parameters
   */
  parseURLParams(url: string): VotePageParams {
    try {
      let queryString: string;
      
      // Handle both full URLs and query strings
      if (url.includes('?')) {
        if (url.startsWith('http')) {
          // Full URL - extract query string
          const urlObj = new URL(url);
          queryString = urlObj.search.substring(1); // Remove the '?' prefix
        } else {
          // URL fragment starting with '?' - extract query part
          queryString = url.substring(url.indexOf('?') + 1);
        }
      } else {
        // Assume it's already a query string without '?'
        queryString = url;
      }
      
      // Decode URL parameters
      const rawParams = decodeURLParams(queryString);
      
      // Extract and sanitize required parameters
      const candidateId = this.extractAndSanitizeParam(rawParams, 'candidate_id');
      const candidateName = this.extractAndSanitizeParam(rawParams, 'candidate_name');
      const source = this.extractAndSanitizeParam(rawParams, 'source');
      
      // Extract optional parameters
      const category = rawParams.category ? sanitizeInput(rawParams.category) : undefined;
      const timestamp = rawParams.timestamp ? sanitizeInput(rawParams.timestamp) : undefined;
      
      // Construct vote page parameters
      const votePageParams: VotePageParams = {
        candidateId: candidateId || '',
        candidateName: candidateName || '',
        source: (source as 'qrcode' | 'direct') || 'direct',
        category: category || undefined,
        timestamp: timestamp || undefined
      };
      
      return votePageParams;
      
    } catch (error) {
      // Return empty/default parameters if parsing fails
      console.warn('Failed to parse URL parameters:', error);
      return {
        candidateId: '',
        candidateName: '',
        source: 'direct'
      };
    }
  }

  /**
   * Validate vote page parameters
   * Performs comprehensive validation of all parameters
   * @param params - Parameters to validate
   * @returns Validation result with errors and sanitized params
   */
  validateParams(params: VotePageParams): ValidationResult {
    // Use the existing comprehensive validation function
    return validateVotePageParams(params);
  }

  /**
   * Render vote page component (placeholder implementation)
   * This would typically integrate with a frontend framework
   * @param params - Vote page parameters
   * @returns Vote page component
   */
  renderVotePage(params: VotePageParams): VotePageComponent {
    // This is a basic implementation - in a real application,
    // this would integrate with React, Vue, or another framework
    return {
      props: params,
      render: () => {
        return `<div class="vote-page">
          <h1>Vote for ${params.candidateName}</h1>
          <p>Candidate ID: ${params.candidateId}</p>
          ${params.category ? `<p>Category: ${params.category}</p>` : ''}
          <p>Source: ${params.source}</p>
        </div>`;
      },
      mount: (container: HTMLElement) => {
        container.innerHTML = `<div class="vote-page">
          <h1>Vote for ${params.candidateName}</h1>
          <p>Candidate ID: ${params.candidateId}</p>
          ${params.category ? `<p>Category: ${params.category}</p>` : ''}
          <p>Source: ${params.source}</p>
        </div>`;
      },
      unmount: () => {
        // Cleanup logic would go here
      }
    } as VotePageComponent;
  }

  /**
   * Extract and sanitize a parameter from raw parameters
   * @param rawParams - Raw decoded parameters
   * @param paramName - Name of parameter to extract
   * @returns Sanitized parameter value or empty string
   */
  private extractAndSanitizeParam(rawParams: Record<string, string>, paramName: string): string {
    const value = rawParams[paramName];
    if (!value || typeof value !== 'string') {
      return '';
    }
    return sanitizeInput(value);
  }

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
  } {
    const errors: string[] = [];
    
    try {
      const params = this.parseURLParams(url);
      
      // Check if we got meaningful parameters
      if (!params.candidateId && !params.candidateName) {
        errors.push('No valid parameters found in URL');
        return { success: false, errors };
      }
      
      return { success: true, params, errors: [] };
      
    } catch (error) {
      errors.push(`URL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, errors };
    }
  }

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
  } {
    // First parse the URL
    const parseResult = this.parseURLParamsWithErrors(url);
    
    if (!parseResult.success || !parseResult.params) {
      return {
        parseSuccess: false,
        validationResult: { isValid: false, errors: parseResult.errors },
        parseErrors: parseResult.errors
      };
    }
    
    // Then validate the parsed parameters
    const validationResult = this.validateParams(parseResult.params);
    
    return {
      parseSuccess: true,
      validationResult,
      params: validationResult.sanitizedParams || parseResult.params,
      parseErrors: []
    };
  }

  /**
   * Extract specific parameter from URL
   * Utility method to get a single parameter value
   * @param url - URL to parse
   * @param paramName - Name of parameter to extract
   * @returns Parameter value or null if not found
   */
  extractParameter(url: string, paramName: string): string | null {
    try {
      const params = this.parseURLParams(url);
      
      switch (paramName) {
        case 'candidate_id':
        case 'candidateId':
          return params.candidateId || null;
        case 'candidate_name':
        case 'candidateName':
          return params.candidateName || null;
        case 'category':
          return params.category || null;
        case 'source':
          return params.source || null;
        case 'timestamp':
          return params.timestamp || null;
        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if URL contains valid voting parameters
   * Quick validation method for URL screening
   * @param url - URL to check
   * @returns Whether URL appears to contain valid voting parameters
   */
  hasValidVotingParams(url: string): boolean {
    try {
      const params = this.parseURLParams(url);
      
      // Check for minimum required parameters
      return !!(params.candidateId && 
                params.candidateName && 
                params.source &&
                URL_VALIDATION_RULES.VALID_SOURCES.includes(params.source as any));
    } catch (error) {
      return false;
    }
  }

  /**
   * Normalize URL parameters
   * Ensures consistent parameter format and encoding
   * @param params - Parameters to normalize
   * @returns Normalized parameters
   */
  normalizeParams(params: VotePageParams): VotePageParams {
    return {
      candidateId: params.candidateId.trim(),
      candidateName: params.candidateName.trim(),
      source: params.source,
      category: params.category?.trim() || undefined,
      timestamp: params.timestamp?.trim() || undefined
    };
  }

  /**
   * Convert parameters back to URL query string
   * Utility method for reconstructing URLs
   * @param params - Parameters to convert
   * @returns URL query string
   */
  paramsToQueryString(params: VotePageParams): string {
    const searchParams = new URLSearchParams();
    
    searchParams.set('candidate_id', params.candidateId);
    searchParams.set('candidate_name', params.candidateName);
    searchParams.set('source', params.source);
    
    if (params.category) {
      searchParams.set('category', params.category);
    }
    
    if (params.timestamp) {
      searchParams.set('timestamp', params.timestamp);
    }
    
    return searchParams.toString();
  }

  /**
   * Create a complete voting URL from parameters
   * @param params - Vote page parameters
   * @param baseURL - Base URL for the voting page
   * @returns Complete voting URL
   */
  createVotingURL(params: VotePageParams, baseURL: string = 'https://domain.com'): string {
    const cleanBaseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    const queryString = this.paramsToQueryString(params);
    return `${cleanBaseURL}/vote?${queryString}`;
  }
}

/**
 * Factory function to create a new Vote Page Router instance
 * @returns New VotePageRouter instance
 */
export function createVotePageRouter(): VotePageRouter {
  return new VotingPageRouter();
}

/**
 * Utility functions for vote page routing
 */
export const VotePageRouterUtils = {
  /**
   * Quick parse and validate URL
   * @param url - URL to process
   * @returns Validation result with parsed parameters
   */
  quickValidate(url: string): ValidationResult & { params?: VotePageParams } {
    const router = createVotePageRouter();
    const params = router.parseURLParams(url);
    const validation = router.validateParams(params);
    
    return {
      ...validation,
      params: validation.isValid ? (validation.sanitizedParams || params) : undefined
    };
  },

  /**
   * Extract candidate information from URL
   * @param url - Voting URL
   * @returns Candidate information or null
   */
  extractCandidateInfo(url: string): { id: string; name: string; category?: string } | null {
    const router = createVotePageRouter();
    const params = router.parseURLParams(url);
    
    if (!params.candidateId || !params.candidateName) {
      return null;
    }
    
    return {
      id: params.candidateId,
      name: params.candidateName,
      category: params.category
    };
  },

  /**
   * Check if URL is a valid voting URL
   * @param url - URL to check
   * @returns Whether URL is valid for voting
   */
  isValidVotingURL(url: string): boolean {
    const validation = this.quickValidate(url);
    return validation.isValid;
  },

  /**
   * Sanitize voting URL parameters
   * @param url - URL to sanitize
   * @returns Sanitized URL or null if invalid
   */
  sanitizeVotingURL(url: string): string | null {
    const router = createVotePageRouter() as VotingPageRouter;
    const result = router.parseAndValidateURL(url);
    
    if (!result.validationResult.isValid || !result.params) {
      return null;
    }
    
    return router.createVotingURL(result.params);
  }
};

/**
 * Default export for convenience
 */
export default VotingPageRouter;