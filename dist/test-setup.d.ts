/**
 * Test setup configuration for QR Code Voting URL feature
 * Configures Jest and fast-check for property-based testing
 */
import * as fc from 'fast-check';
/**
 * Generator for valid candidate IDs
 */
export declare const validCandidateIdArb: fc.Arbitrary<string>;
/**
 * Generator for valid candidate names (including Chinese characters)
 */
export declare const validCandidateNameArb: fc.Arbitrary<string>;
/**
 * Generator for invalid candidate names (too long, empty, or with invalid characters)
 */
export declare const invalidCandidateNameArb: fc.Arbitrary<string>;
/**
 * Generator for valid categories
 */
export declare const validCategoryArb: fc.Arbitrary<string | undefined>;
/**
 * Generator for valid sources
 */
export declare const validSourceArb: fc.Arbitrary<string>;
/**
 * Generator for valid timestamps (within 24 hours)
 */
export declare const validTimestampArb: fc.Arbitrary<string | undefined>;
/**
 * Generator for expired timestamps (older than 24 hours)
 */
export declare const expiredTimestampArb: fc.Arbitrary<string>;
/**
 * Generator for valid CandidateInfo objects
 */
export declare const validCandidateInfoArb: fc.Arbitrary<{
    id: string;
    name: string;
    category: string | undefined;
    metadata: Record<string, unknown> | undefined;
}>;
/**
 * Generator for valid VotePageParams objects
 */
export declare const validVotePageParamsArb: fc.Arbitrary<{
    candidateId: string;
    candidateName: string;
    category: string | undefined;
    source: string;
    timestamp: string | undefined;
}>;
/**
 * Generator for invalid VotePageParams (missing required fields)
 */
export declare const invalidVotePageParamsArb: fc.Arbitrary<{
    candidateName: string;
    source: string;
} | {
    candidateId: string;
    source: string;
} | {
    candidateId: string;
    candidateName: string;
} | {
    candidateId: string;
    candidateName: string;
    source: string;
}>;
/**
 * Generator for URL parameter strings
 */
export declare const urlParamStringArb: fc.Arbitrary<string>;
/**
 * Generator for malicious input strings (for security testing)
 */
export declare const maliciousInputArb: fc.Arbitrary<string>;
/**
 * Helper to create test data for unit tests
 */
export declare const testData: {
    validCandidate: {
        id: string;
        name: string;
        category: string;
        metadata: {
            department: string;
        };
    };
    validVoteParams: {
        candidateId: string;
        candidateName: string;
        category: string;
        source: "qrcode";
        timestamp: string;
    };
    validUser: {
        id: string;
        username: string;
        email: string;
        hasVotingRights: boolean;
    };
};
/**
 * Mock console methods for testing
 */
export declare function mockConsole(): {
    assert(condition?: boolean, ...data: any[]): void;
    assert(value: any, message?: string, ...optionalParams: any[]): void;
    clear(): void;
    clear(): void;
    count(label?: string): void;
    count(label?: string): void;
    countReset(label?: string): void;
    countReset(label?: string): void;
    debug(...data: any[]): void;
    debug(message?: any, ...optionalParams: any[]): void;
    dir(item?: any, options?: any): void;
    dir(obj: any, options?: import("util").InspectOptions): void;
    dirxml(...data: any[]): void;
    dirxml(...data: any[]): void;
    error(...data: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    group(...data: any[]): void;
    group(...label: any[]): void;
    groupCollapsed(...data: any[]): void;
    groupCollapsed(...label: any[]): void;
    groupEnd(): void;
    groupEnd(): void;
    info(...data: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    log(...data: any[]): void;
    log(message?: any, ...optionalParams: any[]): void;
    table(tabularData?: any, properties?: string[]): void;
    table(tabularData: any, properties?: readonly string[]): void;
    time(label?: string): void;
    time(label?: string): void;
    timeEnd(label?: string): void;
    timeEnd(label?: string): void;
    timeLog(label?: string, ...data: any[]): void;
    timeLog(label?: string, ...data: any[]): void;
    timeStamp(label?: string): void;
    timeStamp(label?: string): void;
    trace(...data: any[]): void;
    trace(message?: any, ...optionalParams: any[]): void;
    warn(...data: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    Console: console.ConsoleConstructor;
    profile(label?: string): void;
    profileEnd(label?: string): void;
};
declare const _default: {};
export default _default;
//# sourceMappingURL=test-setup.d.ts.map