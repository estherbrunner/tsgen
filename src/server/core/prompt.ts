import type { TypeCheckResult } from '../../shared/types'
import { formatErrorsForLLM, formatSignatureForLLM } from './analyze'

/**
 * Creates a prompt for generating high-quality TypeScript functions
 *
 * @param {string} userGoal - The specific function requirement or description
 * @returns {string} Complete prompt with instructions and user goal
 * @throws {Error} When userGoal is empty or only whitespace
 */
export function createFunctionPrompt(userGoal: string): string {
	if (!userGoal?.trim()) {
		throw new Error('User goal cannot be empty or only whitespace')
	}

	return `You are an expert TypeScript developer. Generate a single, production-ready TypeScript function based on the user requirement.

REQUIREMENTS:
- Target: ESNext with strict TypeScript types
- Style: Functional programming (pure functions, immutability)
- Documentation: Complete JSDoc with @param, @returns, @throws
- Quality: Clean, readable, maintainable code
- Errors: Proper error handling with specific error types

JSDoc TEMPLATE:
/**
 * Brief function description
 *
 * @param {Type} name - Parameter description
 * @returns {Type} Return value description
 * @throws {ErrorType} When condition occurs
 */

OUTPUT: Only the TypeScript function with JSDoc - no explanations or additional text.

USER REQUIREMENT:
${userGoal}`
}

/**
 * Creates a retry prompt with error feedback for the LLM
 *
 * @param {string} userGoal - Original user requirement
 * @param {string} previousCode - Code that failed type checking
 * @param {TypeCheckResult} typeCheckResult - Results from type checking
 * @returns {string} Formatted retry prompt with error context
 */
export function createRetryPrompt(
	userGoal: string,
	previousCode: string,
	typeCheckResult: TypeCheckResult
): string {
	const errorSummary = formatErrorsForLLM(typeCheckResult.errors)
	const signatureInfo = typeCheckResult.signature
		? formatSignatureForLLM(typeCheckResult.signature)
		: 'Could not extract function signature'

	return `You are an expert TypeScript developer. The previous function had compilation errors. Fix them and generate a corrected version.

ORIGINAL REQUIREMENT:
${userGoal}

PREVIOUS CODE (WITH ERRORS):
${previousCode}

TYPE CHECK RESULTS:
${signatureInfo}

COMPILATION ERRORS TO FIX:
${errorSummary}

REQUIREMENTS FOR CORRECTION:
- Target: ESNext with strict TypeScript types
- Style: Functional programming (pure functions, immutability)
- Documentation: Complete JSDoc with @param, @returns, @throws
- Fix ALL compilation errors listed above
- Maintain the original function purpose and behavior
- Keep code clean, readable, and maintainable

OUTPUT: Only the corrected TypeScript function with JSDoc - no explanations or additional text.`
}

/**
 * Create a TypeScript test for the function that ${userGoal}.
 *
 * @param userGoal
 * @param signature
 * @param generalTests
 * @returns
 */
export function createTestPrompt(
	userGoal: string,
	signature: string,
	generalTests: string[]
): string {
	return `Generate a TypeScript test for the function that ${userGoal}.

The function has the following signature: ${signature}.

The tests should cover expected and unexpected inputs specific to the domain of the function. Don't repeat the following auto-generated tests:
${generalTests.join('\n')}`
}
