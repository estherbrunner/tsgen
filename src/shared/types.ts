/**
 * Shared types for the TypeScript Function Generator
 */

// Request to generate a TypeScript function
export interface FunctionRequest {
  // Natural language prompt describing the function to generate
  prompt: string;
  
  // Optional configuration for function generation
  options?: {
    // Target TypeScript/ECMAScript version
    targetVersion?: 'ES5' | 'ES6' | 'ES2016' | 'ES2017' | 'ES2018' | 'ES2019' | 'ES2020' | 'ES2021' | 'ES2022' | 'latest';
    
    // Whether to use functional programming style where possible
    functionalStyle?: boolean;
    
    // Whether to include JSDoc comments
    includeJSDoc?: boolean;
    
    // Whether to include detailed type definitions
    strictTypes?: boolean;
    
    // Maximum complexity allowed (higher numbers allow more complex solutions)
    complexityLevel?: 1 | 2 | 3 | 4 | 5;
  };
  
  // Optional test cases to validate the generated function
  testCases?: string[];
}

// Response from the function generation API
export interface FunctionResponse {
  // Whether the generation was successful
  success: boolean;
  
  // The generated TypeScript code (if successful)
  code?: string;
  
  // Error message (if not successful)
  error?: string;
  
  // Results of type checking the generated code
  typeCheckResults?: TypeCheckResult;
  
  // Results of linting the generated code
  lintResults?: LintResult;
  
  // Results of running tests on the generated code
  testResults?: TestResult;
}

// Results of type checking
export interface TypeCheckResult {
  // Whether type checking passed
  success: boolean;
  
  // Any error messages from type checking
  message?: string;
  
  // Any warnings from type checking
  warnings?: string[];
}

// Results of linting
export interface LintResult {
  // Whether linting passed (no errors, may have warnings)
  success: boolean;
  
  // List of linting issues
  issues: LintIssue[];
}

// A single linting issue
export interface LintIssue {
  // The severity of the issue
  severity: 'error' | 'warning' | 'info';
  
  // The message describing the issue
  message: string;
  
  // The line number where the issue occurs
  line: number;
  
  // The column number where the issue occurs
  column: number;
  
  // The rule that triggered the issue
  rule: string;
}

// Results of running tests
export interface TestResult {
  // Whether all tests passed
  success: boolean;
  
  // List of test results
  tests: TestCaseResult[];
  
  // Overall test coverage percentage (0-100)
  coverage?: number;
}

// Result of a single test case
export interface TestCaseResult {
  // Name or description of the test
  name: string;
  
  // Whether the test passed
  passed: boolean;
  
  // Message describing the test result
  message: string;
  
  // Time taken to run the test (in milliseconds)
  executionTime?: number;
}