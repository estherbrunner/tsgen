import type { TypeCheckResult } from '../../shared/types'
import { execAsync } from './exec'
import { createTempFiles } from './fs'
import { extractFunctionSignature, parseTypeScriptErrors } from '../core/check'

/**
 * Type checks a TypeScript function using the local TypeScript compiler
 *
 * @param {string} functionCode - The TypeScript function code to type check
 * @returns {Promise<TypeCheckResult>} Type checking results with signature and errors
 * @throws {Error} When temporary file operations fail or tsc is not available
 */
export async function typeCheckFunction(
	functionCode: string
): Promise<TypeCheckResult> {
	if (!functionCode?.trim()) {
		throw new Error('Function code cannot be empty or only whitespace')
	}

	const fileName = 'ts-check-temp.ts'
	let tempFiles
	try {
		tempFiles = await createTempFiles([
			{ name: fileName, contents: functionCode },
		])
	} catch (error) {
		throw error
	}

	try {
		// Run TypeScript compiler with JSON output
		const tscCommand = `npx tsc --noEmit --strict --target ESNext --moduleResolution node --skipLibCheck --pretty false ${tempFiles.paths[0]}`

		// let stdout = ''
		let stderr = ''

		try {
			const result = await execAsync(tscCommand)
			// stdout = result.stdout
			stderr = result.stderr
		} catch (execError: any) {
			// tsc returns non-zero exit code when there are errors, but we still want the output
			// stdout = execError.stdout || ''
			stderr = execError.stderr || ''
		}

		// Parse TypeScript errors from stderr
		const errors = parseTypeScriptErrors(stderr, fileName)

		// Extract function signature from the code
		const signature = extractFunctionSignature(functionCode)

		return {
			signature,
			errors,
			isValid: errors.length === 0 && signature !== null,
		}
	} catch (error) {
		throw new Error(
			`Type checking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	} finally {
		tempFiles.cleanup()
	}
}
