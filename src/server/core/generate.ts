import type {
	GenerationResult,
	IterationConfig,
	IterationStep,
	TypeCheckResult,
} from '../../shared/types'
import { typeCheckFunction } from '../io/tsc'
import { hasCompilationErrors } from './check'
import { extractCodeBlock } from './extract'
import { createFunctionPrompt, createRetryPrompt } from './prompt'

/**
 * Generates a TypeScript function with iterative error correction using local LLM
 *
 * @param {string} userGoal - The specific function requirement or description
 * @param {IterationConfig} config - Configuration for retries and LLM function
 * @returns {Promise<GenerationResult>} Final generation result with history
 * @throws {Error} When userGoal is empty or LLM function is not provided
 */
export async function generateFunctionWithRetries(
	userGoal: string,
	config: IterationConfig
): Promise<GenerationResult> {
	if (!userGoal?.trim()) {
		throw new Error('User goal cannot be empty or only whitespace')
	}

	if (!config.llmFunction) {
		throw new Error('LLM function must be provided in config')
	}

	if (config.maxRetries < 0) {
		throw new Error('Max retries must be non-negative')
	}

	const iterationHistory: IterationStep[] = []
	let currentCode = ''
	let typeCheckResult: TypeCheckResult

	// Initial generation
	const initialPrompt = createFunctionPrompt(userGoal)
	currentCode = await config.llmFunction(initialPrompt)
	typeCheckResult = await typeCheckFunction(extractCodeBlock(currentCode))

	iterationHistory.push({
		iteration: 0,
		code: currentCode,
		errors: typeCheckResult.errors,
		errorCount: typeCheckResult.errors.filter(e => e.severity === 'error')
			.length,
	})

	// Iterate while there are errors and retries remain
	let iteration = 1
	while (
		iteration <= config.maxRetries &&
		hasCompilationErrors(typeCheckResult)
	) {
		const retryPrompt = createRetryPrompt(
			userGoal,
			currentCode,
			typeCheckResult
		)
		currentCode = await config.llmFunction(retryPrompt)
		typeCheckResult = await typeCheckFunction(currentCode)

		iterationHistory.push({
			iteration,
			code: currentCode,
			errors: typeCheckResult.errors,
			errorCount: typeCheckResult.errors.filter(
				e => e.severity === 'error'
			).length,
		})

		iteration++
	}

	return {
		success: !hasCompilationErrors(typeCheckResult),
		code: currentCode,
		typeCheckResult,
		iterations: iteration - 1,
		iterationHistory,
	}
}
