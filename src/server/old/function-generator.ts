/**
 * Function generator for TypeScript code
 * Handles the actual code generation from natural language prompts using LMStudio LLM API
 */

import * as prettier from 'prettier'

// LMStudio API configuration
const LMSTUDIO_BASE_URL = 'http://localhost:1234/v1'

/**
 * Get available models from LMStudio
 */
async function getAvailableModels(): Promise<string[]> {
	try {
		const response = await fetch(`${LMSTUDIO_BASE_URL}/models`)
		if (!response.ok) {
			throw new Error(
				`LMStudio server returned ${response.status}: ${response.statusText}. Please ensure LMStudio is running and accessible at ${LMSTUDIO_BASE_URL}`
			)
		}
		const data = await response.json()
		const models = data.data?.map((model: any) => model.id) || []
		if (models.length === 0) {
			throw new Error(
				'No models available in LMStudio. Please load a model in LMStudio first.'
			)
		}
		return models
	} catch (error) {
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new Error(
				`Cannot connect to LMStudio at ${LMSTUDIO_BASE_URL}. Please ensure LMStudio is running and accessible.`
			)
		}
		throw error
	}
}

/**
 * Generate a TypeScript function from a natural language prompt using LMStudio LLM
 *
 * @param prompt - Natural language description of the function to create
 * @returns The generated TypeScript code as a string
 */
export async function generateFunction(prompt: string): Promise<string> {
	try {
		// Get available models - this will throw if LMStudio is not available
		const models = await getAvailableModels()
		const modelToUse = models[0]

		// Build the system prompt with standard high-quality options
		const systemPrompt = buildSystemPrompt()

		// Build the user prompt
		const userPrompt = buildUserPrompt(prompt)

		// Call LMStudio API
		const response = await fetch(`${LMSTUDIO_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: modelToUse,
				messages: [
					{
						role: 'system',
						content: systemPrompt,
					},
					{
						role: 'user',
						content: userPrompt,
					},
				],
				temperature: 0.3,
				max_tokens: 1000,
				stream: false,
			}),
		})

		if (!response.ok) {
			throw new Error(
				`LMStudio API error: ${response.status} ${response.statusText}`
			)
		}

		const data = await response.json()
		const generatedCode = data.choices?.[0]?.message?.content

		if (!generatedCode) {
			throw new Error('No code generated from LLM response')
		}

		// Clean up the generated code
		const cleanedCode = cleanGeneratedCode(generatedCode)

		// Format the code with Prettier
		return await formatCode(cleanedCode)
	} catch (error) {
		if (error instanceof Error) {
			throw error // Re-throw with original message for better error reporting
		}
		throw new Error(`Error generating function with LLM: ${error}`)
	}
}

/**
 * Build system prompt with standardized high-quality options
 */
function buildSystemPrompt(): string {
	return `You are an expert TypeScript developer. Generate clean, well-structured TypeScript functions based on user requirements.

STANDARDS (ALWAYS APPLY):
- Target version: ESNext
- Programming style: Functional programming (pure functions, immutability where possible)
- Type strictness: Strict TypeScript types (no "any" unless absolutely necessary)
- JSDoc comments: ALWAYS include comprehensive JSDoc with @param, @returns, and @throws
- Complexity level: Low to medium (prefer readable, maintainable code)
- Error handling: Include proper error handling with specific @throws annotations

MANDATORY JSDoc FORMAT:
/**
 * Function description
 *
 * @param {type} paramName - Description
 * @returns {type} Description
 * @throws {ErrorType} When specific condition occurs
 */
`
}

/**
 * Build user prompt for the LLM
 */
function buildUserPrompt(prompt: string): string {
	return `Create a TypeScript function that: ${prompt}

REQUIREMENTS:
- Include comprehensive JSDoc comments with @param, @returns, and @throws annotations
- Use functional programming patterns where possible (pure functions, immutability)
- Use strict TypeScript types with no "any" types unless absolutely necessary
- Include proper error handling and validation
- Document all possible error conditions with @throws JSDoc comments
- Follow ESNext standards and best practices

Remember: ALWAYS include @throws JSDoc annotations for any error conditions the function might encounter.`
}

/**
 * Clean up generated code by removing markdown formatting and extra text
 */
function cleanGeneratedCode(code: string): string {
	// Remove markdown code blocks
	return code
		.replace(/```(?:typescript|ts|javascript|js)?\s*\n?/g, '')
		.replace(/```\s*$/g, '')
}

/**
 * Format generated code using Prettier
 */
async function formatCode(code: string): Promise<string> {
	try {
		// Get Prettier configuration
		const config = (await prettier.resolveConfig(process.cwd())) || {}

		// Format the code with Prettier
		const formatted = await prettier.format(code, config)
		return formatted.trim()
	} catch (error) {
		// If Prettier fails, return the original code
		console.warn(
			'Prettier formatting failed for generated code:',
			error instanceof Error ? error.message : String(error)
		)
		return code
	}
}
