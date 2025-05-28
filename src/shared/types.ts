/**
 * Shared types for the TypeScript Function Generator
 */

export type FunctionRequest = {
	prompt: string
}

export type FunctionResponse = {
	success: boolean
	code: string
	typeCheckResult: TypeCheckResult
	lintResult: FormatLintResult
	testResult: TestResult
}

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
 * Represents a function parameter with its type information
 */
export type FunctionParameter = {
	name: string
	type: string
	optional: boolean
	rest: boolean
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
	code: number
	message: string
	severity: 'error' | 'warning'
}

/**
 * Result of TypeScript type checking operation
 */
export type TypeCheckResult = {
	signature: FunctionSignature | null
	errors: TypeCheckError[]
	isValid: boolean
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
 * Configuration for formatting and linting operations
 */
export type FormatLintConfig = {
	prettierConfig?: string
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
	fixedCode: string | null
	fixedIssues: number
	errors: LintError[]
}

/**
 * Result of formatting and linting operations
 */
export type FormatLintResult = {
	formattedCode: string
	prettierApplied: boolean
	eslintApplied: boolean
	eslintErrors: LintError[]
	autoFixedIssues: number
	success: boolean
}

/**
 * Represents a generic test case
 */
export type GenericTestCase = {
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
	customTestCases?: GenericTestCase[]
}

/**
 * Result of test execution
 */
export type TestResult = {
	totalTests: number
	passedTests: number
	failedTests: number
	testResults: TestCaseResult[]
	success: boolean
	executionTime: number
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
 * Result of iterative function generation process
 */
export type GenerationResult = {
	finalCode: string
	typeCheckResult: TypeCheckResult
	iterations: number
	success: boolean
	iterationHistory: IterationStep[]
}
