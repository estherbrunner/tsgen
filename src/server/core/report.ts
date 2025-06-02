import type {
	LintResult,
	GenerationResult,
	TestResult,
} from '../../shared/types'
import { formatErrorsForLLM } from './check'

/**
 * Creates a summary report of the generation process
 *
 * @param {GenerationResult} result - Complete generation result
 * @returns {string} Human-readable summary report
 */
export function createGenerationReport(result: GenerationResult): string {
	const { success, iterations, typeCheckResult, iterationHistory } = result

	let report = `=== TYPESCRIPT FUNCTION GENERATION REPORT ===\n\n`
	report += `Status: ${success ? '✅ SUCCESS' : '❌ FAILED'}\n`
	report += `Iterations: ${iterations}\n`
	report += `Final Errors: ${typeCheckResult.errors.filter(e => e.severity === 'error').length}\n`
	report += `Final Warnings: ${typeCheckResult.errors.filter(e => e.severity === 'warning').length}\n\n`

	if (typeCheckResult.signature) {
		report += `Final Function: ${typeCheckResult.signature.name}\n`
		report += `Parameters: ${typeCheckResult.signature.parameters.length}\n`
		report += `Return Type: ${typeCheckResult.signature.returnType}\n\n`
	}

	report += `=== ITERATION HISTORY ===\n`
	iterationHistory.forEach(step => {
		report += `Iteration ${step.iteration}: ${step.errorCount} errors\n`
	})

	if (!success && typeCheckResult.errors.length > 0) {
		report += `\n=== REMAINING ERRORS ===\n`
		report += formatErrorsForLLM(typeCheckResult.errors)
	}

	return report
}

/**
 * Creates a summary report of the formatting and linting process
 *
 * @param {FormatLintResult} result - Complete formatting and linting result
 * @returns {string} Human-readable summary report
 */
export function createFormatLintReport(result: LintResult): string {
	let report = `=== FORMATTING & LINTING REPORT ===\n\n`

	report += `Auto-fixed Issues: ${result.fixedIssues}\n`
	report += `Remaining Errors: ${result.errors.filter(e => e.severity === 'error').length}\n`
	report += `Remaining Warnings: ${result.errors.filter(e => e.severity === 'warning').length}\n`
	report += `Overall Success: ${result.success ? '✅' : '❌'}\n\n`

	if (result.errors.length > 0) {
		report += `=== ESLINT ISSUES ===\n`

		const errors = result.errors.filter(e => e.severity === 'error')
		const warnings = result.errors.filter(e => e.severity === 'warning')

		if (errors.length > 0) {
			report += `ERRORS:\n`
			errors.forEach((error, index) => {
				report += `${index + 1}. Line ${error.line}:${error.column} [${error.ruleId}]: ${error.message}\n`
			})
			report += '\n'
		}

		if (warnings.length > 0) {
			report += `WARNINGS:\n`
			warnings.forEach((warning, index) => {
				report += `${index + 1}. Line ${warning.line}:${warning.column} [${warning.ruleId}]: ${warning.message}\n`
			})
		}
	}

	return report
}

/**
 * Creates a comprehensive test report
 *
 * @param {TestResult} result - Test execution results
 * @returns {string} Human-readable test report
 */
export function createTestReport(result: TestResult): string {
	let report = `=== AUTOMATED TEST REPORT ===\n\n`

	report += `Overall Success: ${result.success ? '✅' : '❌'}\n`
	report += `Total Tests: ${result.totalTests}\n`
	report += `Passed: ${result.passedTests}\n`
	report += `Failed: ${result.failedTests}\n`
	report += `Execution Time: ${result.executionTime}ms\n\n`

	if (result.failedTests > 0) {
		report += `=== FAILED TESTS ===\n`
		const failedTests = result.testResults.filter(t => !t.passed)

		failedTests.forEach((test, index) => {
			report += `${index + 1}. ${test.name}\n`
			report += `   Description: ${test.description}\n`
			report += `   Error: ${test.error || 'Unknown error'}\n`
			report += `   Time: ${test.executionTime}ms\n\n`
		})
	}

	if (result.passedTests > 0) {
		report += `=== PASSED TESTS ===\n`
		const passedTests = result.testResults.filter(t => t.passed)

		passedTests.forEach((test, index) => {
			report += `${index + 1}. ${test.name} (${test.executionTime}ms)\n`
		})
	}

	return report
}
