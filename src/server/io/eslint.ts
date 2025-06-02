import type { LintConfig, LintError, LintResult } from '../../shared/types'
import { formatCode } from '../core/format'
import { execAsync } from './exec'
import { createTempFiles, readFile } from './fs'

/**
 * Applies ESLint with auto-fix to TypeScript code
 *
 * @param {string} filePath - Path to the temporary TypeScript file
 * @param {FormatLintConfig} config - Configuration with ESLint settings
 * @returns {Promise<Partial<LintResult>>} ESLint processing results
 */
export async function applyESLintWithAutoFix(
	filePath: string,
	config: LintConfig
): Promise<Partial<LintResult>> {
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
	let code: string | null = null
	let fixedIssues = 0

	try {
		const fixCommand = `npx eslint ${configArg} --fix --format json ${filePath}`
		await execAsync(fixCommand)

		// Read potentially fixed file
		code = await readFile(filePath)
		fixedIssues = 1 // We'll get the actual count from the lint report
	} catch (fixError: any) {
		// ESLint returns non-zero exit code even when auto-fixing, so we continue
		try {
			code = await readFile(filePath)
		} catch {
			return {
				success: false,
			}
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
		success: errors.filter(e => e.severity === 'error').length === 0,
		code,
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
	config: LintConfig = {}
): Promise<LintResult> {
	if (!code?.trim()) {
		throw new Error('Code cannot be empty or only whitespace')
	}

	let formattedCode = await formatCode(code)
	let lintResult: LintResult = {
		success: false,
		code: formattedCode,
		fixedIssues: 0,
		errors: [],
	}

	const fileName = 'ts-lint-temp.ts'
	let tempFiles
	try {
		tempFiles = await createTempFiles([
			{
				name: fileName,
				contents: formattedCode,
			},
		])
	} catch (error) {
		throw error
	}

	// Apply ESLint with auto-fix
	try {
		const partialLintResult = await applyESLintWithAutoFix(
			tempFiles.paths[0],
			config
		)
		lintResult = { ...lintResult, ...partialLintResult }
	} catch (eslintError) {
		console.warn('ESLint processing failed:', eslintError)
		// Continue without ESLint if it fails
	} finally {
		tempFiles.cleanup()
	}

	return lintResult
}
