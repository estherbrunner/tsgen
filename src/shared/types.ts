/**
 * Shared types for the TypeScript Function Generator
 */

/**
 * Represents a file name and its content
 */
export type FileNameAndContents = {
	name: string
	contents: string
}

/**
 * Represents temporary files with cleanup functionality
 */
export type TempFiles = {
	paths: string[]
	cleanup: () => Promise<void>
}

/**
 * Represents a request to write a TypeScript function
 */
export type FunctionRequest = {
	userGoal: string
}

/**
 * Represents a function parameter with its type information
 */
export type FunctionParameter = {
	name: string
	type: string
	isOptional: boolean
	isRest: boolean
}

/**
 * Represents the extracted function signature
 */
export type FunctionSignature = {
	name: string
	parameters: FunctionParameter[]
	returnType: string
	throwsTypes?: string[]
	isAsync: boolean
}

/**
 * Represents a TypeScript compilation error
 */
export type TypeCheckError = {
	line: number
	column: number
	errorCode: number
	message: string
	severity: 'error' | 'warning'
}

/**
 * Result of TypeScript type checking operation
 */
export type TypeCheckResult = {
	success: boolean
	signature: FunctionSignature | null
	errors: TypeCheckError[]
}

/**
 * Configuration for iterative function generation
 */
export type IterationConfig = {
	maxRetries: number
	llmFunction: (prompt: string) => Promise<string>
}

/**
 * Information about each iteration step
 */
export type IterationStep = {
	iteration: number
	code: string
	errors: TypeCheckError[]
	errorCount: number
}

/**
 * Result of iterative function generation process
 */
export type GenerationResult = {
	success: boolean
	code: string
	typeCheckResult: TypeCheckResult
	iterations: number
	iterationHistory: IterationStep[]
}

/**
 * Configuration for formatting and linting operations
 */
export type LintConfig = {
	eslintConfig?: string
	eslintRules?: Record<string, any>
}

/**
 * Represents an ESLint error or warning
 */
export type LintError = {
	line: number
	column: number
	ruleId: string | null
	message: string
	severity: 'error' | 'warning'
	fixable: boolean
}

/**
 * ESLint processing result
 */
export type LintResult = {
	success: boolean
	code: string
	fixedIssues: number
	errors: LintError[]
}

/**
 * Represents a generic test case
 */
export type TestCase = {
	name: string
	description: string
	input: any[]
	shouldThrow?: boolean
	expectedError?: string
}

/**
 * Configuration for test generation and execution
 */
export type TestConfig = {
	timeout?: number
	verbose?: boolean
	testCases?: TestCase[]
}

/**
 * Individual test case result
 */
export type TestCaseResult = {
	name: string
	description: string
	passed: boolean
	error?: string
	executionTime: number
}

/**
 * Result of test execution
 */
export type TestResult = {
	success: boolean
	totalTests: number
	passedTests: number
	failedTests: number
	testResults: TestCaseResult[]
	executionTime: number
}

/**
 * Represents a response to write a TypeScript function
 */
export type FunctionResponse = {
	success: boolean
	code: string
	typeCheckResult: TypeCheckResult
	lintResult: LintResult
	testResult: TestResult
}
