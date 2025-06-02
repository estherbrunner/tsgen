import type {
	TypeCheckError,
	TypeCheckResult,
	FunctionSignature,
	FunctionParameter,
} from '../../shared/types'

/**
 * Parses TypeScript compiler error output into structured error objects
 *
 * @param {string} errorOutput - Raw stderr output from tsc
 * @param {string} fileName - Name of the temporary file to filter errors
 * @returns {TypeCheckError[]} Array of parsed TypeScript errors
 */
export function parseTypeScriptErrors(
	errorOutput: string,
	fileName: string
): TypeCheckError[] {
	if (!errorOutput?.trim()) {
		return []
	}

	const errors: TypeCheckError[] = []
	const lines = errorOutput.split('\n')

	for (const line of lines) {
		// Match TypeScript error format: filename(line,col): error TS####: message
		const errorMatch = line.match(
			new RegExp(
				`${fileName.replace('.', '\\.')}\\((\\d+),(\\d+)\\):\\s+(error|warning)\\s+TS(\\d+):\\s+(.+)`
			)
		)

		if (errorMatch) {
			errors.push({
				line: parseInt(errorMatch[1], 10),
				column: parseInt(errorMatch[2], 10),
				errorCode: parseInt(errorMatch[4], 10),
				message: errorMatch[5].trim(),
				severity: errorMatch[3] as 'error' | 'warning',
			})
		}
	}

	return errors
}

/**
 * Extracts function signature from TypeScript code
 *
 * @param {string} code - TypeScript function code to analyze
 * @returns {FunctionSignature} Extracted function signature information
 * @throws {Error} When function signature cannot be extracted
 */
export function extractFunctionSignature(code: string): FunctionSignature {
	if (!code?.trim()) {
		throw new Error('Code cannot be empty or only whitespace')
	}

	// Remove comments and normalize whitespace
	const cleanCode = code
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '')

	// Extract function name
	const functionMatch = cleanCode.match(
		/(?:export\s+)?(?:async\s+)?function\s+(\w+)/
	)
	const arrowMatch = cleanCode.match(
		/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/
	)
	const name = functionMatch?.[1] || arrowMatch?.[1] || 'unknownFunction'

	// Check if async
	const isAsync = /(?:async\s+function|=\s*async\s*\()/.test(cleanCode)

	// Extract parameters
	const paramMatch = cleanCode.match(/\(([^)]*)\)/)
	const paramString = paramMatch?.[1] || ''
	const parameters = parseParameters(paramString)

	// Extract return type
	const returnTypeMatch = cleanCode.match(/\):\s*([^{=]+)/)
	let returnType = returnTypeMatch?.[1]?.trim() || 'any'

	// Handle Promise<T> for async functions
	if (isAsync && returnType !== 'any') {
		returnType = returnType.replace(/^Promise<|>$/g, '')
	}

	// Extract @throws annotations from JSDoc
	const throwsMatches = code.match(/@throws\s+\{([^}]+)\}/g) || []
	const throwsTypes = throwsMatches.map(match => {
		const typeMatch = match.match(/@throws\s+\{([^}]+)\}/)
		return typeMatch?.[1] || 'Error'
	})

	return {
		name,
		parameters,
		returnType,
		throwsTypes,
		isAsync,
	}
}

/**
 * Parses parameter string into FunctionParameter objects
 *
 * @param {string} paramString - Function parameters as string
 * @returns {FunctionParameter[]} Array of parsed parameters
 */
function parseParameters(paramString: string): FunctionParameter[] {
	if (!paramString.trim()) return []

	const params: FunctionParameter[] = []
	const paramParts = paramString.split(',').map(p => p.trim())

	for (const part of paramParts) {
		if (!part) continue

		const isRest = part.startsWith('...')
		const cleanPart = part.replace(/^\.\.\./, '')

		const [nameWithOptional, typeWithDefault] = cleanPart
			.split(':')
			.map(s => s?.trim())
		if (!nameWithOptional) continue

		const isOptional =
			nameWithOptional.includes('?') || typeWithDefault?.includes('=')
		const name = nameWithOptional.replace('?', '')

		let type = 'any'
		if (typeWithDefault) {
			const typeMatch = typeWithDefault.match(/^([^=]+)/)
			type = typeMatch?.[1]?.trim() || 'any'
		}

		params.push({
			name,
			type,
			isOptional,
			isRest,
		})
	}

	return params
}

/**
 * Formats TypeScript errors in a clear, actionable way for the LLM
 *
 * @param {TypeCheckError[]} errors - Array of TypeScript errors
 * @returns {string} Formatted error summary
 */
export function formatErrorsForLLM(errors: TypeCheckError[]): string {
	if (errors.length === 0) {
		return 'No errors found.'
	}

	const errorsByType = errors.reduce(
		(acc, error) => {
			if (!acc[error.severity]) {
				acc[error.severity] = []
			}
			acc[error.severity].push(error)
			return acc
		},
		{} as Record<string, TypeCheckError[]>
	)

	let formatted = ''

	if (errorsByType.error) {
		formatted += `ERRORS (${errorsByType.error.length}):\n`
		errorsByType.error.forEach((error, index) => {
			formatted += `${index + 1}. Line ${error.line}, Column ${error.column} (TS${error.errorCode}): ${error.message}\n`
		})
	}

	if (errorsByType.warning) {
		formatted += `\nWARNINGS (${errorsByType.warning.length}):\n`
		errorsByType.warning.forEach((error, index) => {
			formatted += `${index + 1}. Line ${error.line}, Column ${error.column} (TS${error.errorCode}): ${error.message}\n`
		})
	}

	return formatted.trim()
}

/**
 * Formats function signature information for LLM context
 *
 * @param {FunctionSignature} signature - Extracted function signature
 * @returns {string} Formatted signature information
 */
export function formatSignatureForLLM(signature: FunctionSignature): string {
	const params = signature.parameters
		.map(p => `${p.name}${p.isOptional ? '?' : ''}: ${p.type}`)
		.join(', ')

	return `DETECTED SIGNATURE:
Function: ${signature.name}(${params}): ${signature.returnType}
Parameters: ${signature.parameters.length === 0 ? 'None' : signature.parameters.length}`
}

/**
 * Checks if type check result contains compilation errors (not warnings)
 *
 * @param {TypeCheckResult} result - Type check result to examine
 * @returns {boolean} True if there are compilation errors
 */
export function hasCompilationErrors(result: TypeCheckResult): boolean {
	return result.errors.some(error => error.severity === 'error')
}
