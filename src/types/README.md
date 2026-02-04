# QR Code Voting URL - TypeScript Types

This directory contains the TypeScript interface definitions for the QR Code Voting URL feature.

## Files

### `qr-code-voting.ts`
Core TypeScript interfaces and types for the QR Code Voting URL feature, including:

- **Data Types**: `CandidateInfo`, `VotePageParams`, `QRCodeData`, `User`, etc.
- **Component Interfaces**: `QRCodeURLGenerator`, `VotePageRouter`, `AuthenticationGuard`, `VoteInterface`
- **Validation Rules**: Constants for URL validation, security patterns, and error messages
- **Type Guards**: Runtime type checking functions
- **Utility Types**: Partial types and helper types for common operations

## Key Features

1. **Comprehensive Type Safety**: All interfaces follow the design document specifications
2. **Security Patterns**: Built-in validation patterns for preventing injection attacks
3. **Type Guards**: Runtime type checking for safe data handling
4. **Validation Constants**: Centralized validation rules and error messages
5. **Utility Types**: Helper types for common operations and partial updates

## Usage

```typescript
import { 
  CandidateInfo, 
  VotePageParams, 
  ValidationResult,
  isCandidateInfo,
  validateVotePageParams 
} from './qr-code-voting';

// Type-safe candidate creation
const candidate: CandidateInfo = {
  id: 'candidate-123',
  name: '张三',
  category: '最佳员工'
};

// Runtime type checking
if (isCandidateInfo(someData)) {
  // TypeScript knows someData is CandidateInfo
  console.log(someData.name);
}
```

## Validation

All types include corresponding validation functions in `../utils/validation.ts` that implement the security and business rules defined in the design document.