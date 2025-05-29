import * as prettier from 'prettier'

/**
 * Format code using Prettier
 *
 * @param {string} code - The code to format
 * @returns {Promise<string>} The formatted code
 */
export async function formatCode(code: string): Promise<string> {
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
