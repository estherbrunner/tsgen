import {
	FormatLintConfig,
	FormatLintResult,
	LintError,
	LintResult,
} from '../../shared/types'
import { execAsync } from './exec'
import { createTempFiles, readFile, writeFile } from './fs'

/**
 * Applies Prettier formatting to TypeScript code
 *
 * @param {string} path - Path to the temporary TypeScript file
 * @param {string} prettierConfig - Optional path to Prettier config file
 * @returns {Promise<string>} Formatted code
 * @throws {Error} When Prettier command fails
 */
export async function applyPrettierFormatting(
	path: string,
	prettierConfig?: string
): Promise<string> {
	const configArg = prettierConfig ? `--config ${prettierConfig}` : ''
	const prettierCommand = `npx prettier ${configArg} --parser typescript --write ${path}`

	await execAsync(prettierCommand)

	// Read the formatted file
	return await readFile(path)
}

/**
 * Applies ESLint with auto-fix to TypeScript code
 *
 * @param {string} filePath - Path to the temporary TypeScript file
 * @param {FormatLintConfig} config - Configuration with ESLint settings
 * @returns {Promise<LintResult>} ESLint processing results
 */
export async function applyESLintWithAutoFix(
	filePath: string,
	config: FormatLintConfig
): Promise<LintResult> {
	// Create temporary ESLint config if custom rules provided
	let configFile: string | null = null

	/* if (config.eslintRules || !config.eslintConfig) {
		configFile = await createTempESLintConfig(
			path.dirname(filePath),
			config.eslintRules
		)
	} */

	const configArg = config.eslintConfig
		? `--config ${config.eslintConfig}`
		: configFile
			? `--config ${configFile}`
			: ''

	// First, try to auto-fix issues
	let fixedCode: string | null = null
	let fixedIssues = 0

	try {
		const fixCommand = `npx eslint ${configArg} --fix --format json ${filePath}`
		await execAsync(fixCommand)

		// Read potentially fixed file
		fixedCode = await readFile(filePath)
		fixedIssues = 1 // We'll get the actual count from the lint report
	} catch (fixError: any) {
		// ESLint returns non-zero exit code even when auto-fixing, so we continue
		try {
			fixedCode = await readFile(filePath)
		} catch {
			// If we can't read the file, there was no fix applied
		}
	}

	// Then, get remaining issues
	const errors = await getESLintErrors(filePath, configArg)

	// Clean up temp config file
	/* if (configFile) {
		try {
			await fs.unlink(configFile)
		} catch {
			// Ignore cleanup errors
		}
	} */

	return {
		fixedCode,
		fixedIssues,
		errors,
	}
}

/**
 * Gets ESLint errors from a file
 *
 * @param {string} filePath - Path to the file to lint
 * @param {string} configArg - ESLint config argument
 * @returns {Promise<LintError[]>} Array of ESLint errors
 */
async function getESLintErrors(
	filePath: string,
	configArg: string
): Promise<LintError[]> {
	try {
		const lintCommand = `npx eslint ${configArg} --format json ${filePath}`
		const { stdout } = await execAsync(lintCommand)

		const results = JSON.parse(stdout)
		if (!Array.isArray(results) || results.length === 0) {
			return []
		}

		const messages = results[0].messages || []
		return messages.map((msg: any) => ({
			line: msg.line || 0,
			column: msg.column || 0,
			ruleId: msg.ruleId || null,
			message: msg.message || '',
			severity: msg.severity === 2 ? 'error' : 'warning',
			fixable: Boolean(msg.fix),
		}))
	} catch (lintError: any) {
		// Try to parse error output for JSON
		if (lintError.stdout) {
			try {
				const results = JSON.parse(lintError.stdout)
				if (Array.isArray(results) && results.length > 0) {
					const messages = results[0].messages || []
					return messages.map((msg: any) => ({
						line: msg.line || 0,
						column: msg.column || 0,
						ruleId: msg.ruleId || null,
						message: msg.message || '',
						severity: msg.severity === 2 ? 'error' : 'warning',
						fixable: Boolean(msg.fix),
					}))
				}
			} catch {
				// Fall through to return empty array
			}
		}
		return []
	}
}

/**
 * Creates a temporary ESLint configuration file
 *
 * @param {string} dir - Directory to create the config file in
 * @param {Record<string, any>} customRules - Custom ESLint rules
 * @returns {Promise<string>} Path to the created config file
 * /
async function createTempESLintConfig(
	dir: string,
	customRules?: Record<string, any>
): Promise<string> {
	const defaultConfig = {
		parser: '@typescript-eslint/parser',
		parserOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
		},
		plugins: ['@typescript-eslint'],
		extends: ['eslint:recommended', '@typescript-eslint/recommended'],
		rules: {
			'@typescript-eslint/no-unused-vars': 'error',
			'@typescript-eslint/no-explicit-any': 'warn',
			'prefer-const': 'error',
			'no-var': 'error',
			eqeqeq: 'error',
			curly: 'error',
			...customRules,
		},
	}

	const configPath = path.join(dir, '.eslintrc.json')
	await fs.writeFile(
		configPath,
		JSON.stringify(defaultConfig, null, 2),
		'utf8'
	)

	return configPath
} */

/**
 * Processes TypeScript function code through Prettier formatting and ESLint linting
 *
 * @param {string} code - TypeScript function code to process
 * @param {FormatLintConfig} config - Configuration for formatting and linting
 * @returns {Promise<FormatLintResult>} Result of formatting and linting operations
 * @throws {Error} When code is empty or processing fails
 */
export async function formatAndLintFunction(
	code: string,
	config: FormatLintConfig = {}
): Promise<FormatLintResult> {
	if (!code?.trim()) {
		throw new Error('Code cannot be empty or only whitespace')
	}

	let formattedCode = code
	let prettierApplied = false
	let eslintApplied = false
	let eslintErrors: LintError[] = []
	let autoFixedIssues = 0

	const fileName = 'ts-format-temp.ts'
	let tempFiles
	try {
		tempFiles = await createTempFiles([{ name: fileName, contents: code }])
	} catch (error) {
		throw error
	}

	try {
		// Step 1: Apply Prettier formatting
		try {
			formattedCode = await applyPrettierFormatting(
				tempFiles.paths[0],
				config.prettierConfig
			)
			prettierApplied = true

			// Update temp file with formatted code
			await writeFile(tempFiles.paths[0], formattedCode)
		} catch (prettierError) {
			console.warn('Prettier formatting failed:', prettierError)
			// Continue with original code if Prettier fails
		}

		// Step 2: Apply ESLint with auto-fix
		try {
			const eslintResult = await applyESLintWithAutoFix(
				tempFiles.paths[0],
				config
			)

			if (eslintResult.fixedCode) {
				formattedCode = eslintResult.fixedCode
				autoFixedIssues = eslintResult.fixedIssues
			}

			eslintErrors = eslintResult.errors
			eslintApplied = true
		} catch (eslintError) {
			console.warn('ESLint processing failed:', eslintError)
			// Continue without ESLint if it fails
		}

		return {
			formattedCode,
			prettierApplied,
			eslintApplied,
			eslintErrors,
			autoFixedIssues,
			success:
				prettierApplied &&
				eslintApplied &&
				eslintErrors.filter(e => e.severity === 'error').length === 0,
		}
	} catch (error) {
		throw new Error(
			`Format and lint processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	} finally {
		tempFiles.cleanup()
	}
}
