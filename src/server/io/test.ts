import { execAsync } from './exec'
import { createTempFiles } from './fs'

import type { TestCaseResult, TestConfig, TestResult } from '../../shared/types'
import { extractFunctionSignature } from '../core/check'
import { generateBunTestCode, generateGenericTests } from '../core/testgen'

/**
 * Generates and executes comprehensive tests for a TypeScript function using Bun
 *
 * @param {string} functionCode - The TypeScript function code to test
 * @param {TestConfig} config - Configuration for test generation and execution
 * @returns {Promise<TestResult>} Comprehensive test execution results
 * @throws {Error} When test generation or execution fails
 */
export async function generateAndRunTests(
	functionCode: string,
	config: TestConfig = {}
): Promise<TestResult> {
	if (!functionCode?.trim()) {
		throw new Error('Function code cannot be empty or only whitespace')
	}

	const startTime = Date.now()

	// Extract function signature
	const signature = extractFunctionSignature(functionCode)

	// Generate test cases
	const testCases = [
		...generateGenericTests(signature),
		...(config.testCases || []),
	]
	const functionFile = {
		name: 'bun-test-function.ts',
		contents: functionCode,
	}
	const testFile = {
		name: 'bun-test-function.test.ts',
		contents: generateBunTestCode(signature, testCases),
	}
	let tempFiles
	try {
		tempFiles = await createTempFiles([functionFile, testFile])

		// Run tests with Bun
		const testResult = await runBunTests(tempFiles.paths[1], config)

		return {
			...testResult,
			executionTime: Date.now() - startTime,
		}
	} catch (error) {
		throw new Error(
			`Test generation and execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	} finally {
		if (tempFiles) tempFiles.cleanup()
	}
}

/**
 * Executes Bun tests and parses results
 *
 * @param {string} testFile - Path to the test file
 * @param {TestConfig} config - Test configuration
 * @returns {Promise<Omit<TestResult, 'executionTime'>>} Test execution results
 */
async function runBunTests(
	testFile: string,
	config: TestConfig
): Promise<Omit<TestResult, 'executionTime'>> {
	const timeout = config.timeout || 30000
	const verbose = config.verbose || false

	try {
		const bunCommand = `bun test ${verbose ? '--verbose' : ''} ${testFile}`
		const { stdout, stderr } = await execAsync(bunCommand, { timeout })

		return parseBunTestOutput(stdout, stderr)
	} catch (error: any) {
		// Bun test might return non-zero exit code even with passing tests
		if (error.stdout || error.stderr) {
			return parseBunTestOutput(error.stdout || '', error.stderr || '')
		}

		throw new Error(`Bun test execution failed: ${error.message}`)
	}
}

/**
 * Parses Bun test output to extract test results
 *
 * @param {string} stdout - Standard output from Bun test
 * @param {string} stderr - Standard error from Bun test
 * @returns {Omit<TestResult, 'executionTime'>} Parsed test results
 */
function parseBunTestOutput(
	stdout: string,
	stderr: string
): Omit<TestResult, 'executionTime'> {
	const output = stdout + stderr

	// Parse test summary from Bun output
	const passMatch = output.match(/(\d+) pass/)
	const failMatch = output.match(/(\d+) fail/)

	const passedTests = passMatch ? parseInt(passMatch[1], 10) : 0
	const failedTests = failMatch ? parseInt(failMatch[1], 10) : 0
	const totalTests = passedTests + failedTests

	// Extract individual test results
	const testResults: TestCaseResult[] = []
	const testLines = output
		.split('\n')
		.filter(
			line =>
				line.includes('✓') ||
				line.includes('✗') ||
				line.includes('PASS') ||
				line.includes('FAIL')
		)

	for (const line of testLines) {
		const passed = line.includes('✓') || line.includes('PASS')
		const testNameMatch = line.match(/(?:✓|✗)\s*(.+?)(?:\s*\(\d+ms\))?$/)
		const name = testNameMatch?.[1]?.trim() || 'unknown_test'
		const timeMatch = line.match(/\((\d+)ms\)/)
		const executionTime = timeMatch ? parseInt(timeMatch[1], 10) : 0

		testResults.push({
			name,
			description: name,
			passed,
			error: passed ? undefined : 'Test failed',
			executionTime,
		})
	}

	return {
		totalTests,
		passedTests,
		failedTests,
		testResults,
		success: failedTests === 0 && totalTests > 0,
	}
}
