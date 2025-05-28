import { createSystemPrompt } from '../core/prompt'

// LMStudio API configuration
const LMSTUDIO_BASE_URL = 'http://localhost:1234/v1'

/**
 * Get available models from LMStudio
 */
export async function getAvailableModels(): Promise<string[]> {
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
export async function llmFunction(userPrompt: string): Promise<string> {
	try {
		// Get available models - this will throw if LMStudio is not available
		const models = await getAvailableModels()
		const modelToUse = models[0]

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
						content: createSystemPrompt(),
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

		return generatedCode
	} catch (error) {
		if (error instanceof Error) {
			throw error // Re-throw with original message for better error reporting
		}
		throw new Error(`Error generating function with LLM: ${error}`)
	}
}
