import type {
	FunctionParameter,
	FunctionSignature,
	TestCase,
} from '../../shared/types'

/**
 * Generates generic test cases for a function signature
 *
 * @param {FunctionSignature} signature - Function signature to generate tests for
 * @returns {TestCase[]} Array of generated test cases
 */
export function generateGenericTests(signature: FunctionSignature): TestCase[] {
	const tests: TestCase[] = []

	// Test 1: Normal execution with typical values
	tests.push({
		name: 'normal_execution',
		description: `${signature.name} executes with typical input values`,
		input: generateTypicalInputs(signature.parameters),
	})

	// Test 2: Edge case values
	tests.push({
		name: 'edge_case_values',
		description: `${signature.name} handles edge case input values`,
		input: generateEdgeCaseInputs(signature.parameters),
	})

	// Test 3: Null/undefined inputs (if not optional)
	const nullTests = generateNullTests(signature.name, signature.parameters)
	tests.push(...nullTests)

	// Test 4: Type boundary tests
	const boundaryTests = generateBoundaryTests(
		signature.name,
		signature.parameters
	)
	tests.push(...boundaryTests)

	// Test 5: Malformed input tests
	const malformedTests = generateMalformedInputTests(
		signature.name,
		signature.parameters
	)
	tests.push(...malformedTests)

	// Test 6: Empty/zero values
	tests.push({
		name: 'empty_values',
		description: `${signature.name} handles empty/zero values`,
		input: generateEmptyInputs(signature.parameters),
	})

	// Test 7: Large values (if numeric/array types)
	const largeValueTests = generateLargeValueTests(
		signature.name,
		signature.parameters
	)
	if (largeValueTests.length > 0) {
		tests.push(...largeValueTests)
	}

	return tests
}

/**
 * Generates Bun-compatible test code
 *
 * @param {FunctionSignature} signature - Function signature information
 * @param {TestCase[]} testCases - Test cases to generate code for
 * @returns {string} Complete Bun test file content
 */
export function generateBunTestCode(
	signature: FunctionSignature,
	testCases: TestCase[]
): string {
	const functionName = signature.name
	const isAsync = signature.isAsync

	let testCode = `import { test, expect, describe } from 'bun:test';
import { ${functionName} } from './function';

describe('${functionName}', () => {
`

	for (const testCase of testCases) {
		const testFunction = isAsync ? 'async ' : ''
		const awaitKeyword = isAsync ? 'await ' : ''

		testCode += `  test('${testCase.name}', ${testFunction}() => {
    // ${testCase.description}
`

		if (testCase.shouldThrow) {
			testCode += `    expect(() => {
      ${awaitKeyword}${functionName}(${testCase.input.map(i => JSON.stringify(i)).join(', ')});
    }).toThrow();
`
		} else {
			testCode += `    const result = ${awaitKeyword}${functionName}(${testCase.input.map(i => JSON.stringify(i)).join(', ')});
    expect(result).toBeDefined();
`
		}

		testCode += `  });

`
	}

	testCode += `});
`

	return testCode
}

// Re-export all the helper functions from the original code with updated types
function generateTypicalInputs(parameters: FunctionParameter[]): any[] {
	return parameters.map(param => {
		if (param.isRest) {
			return generateTypicalValue(param.type.replace(/\[\]$/, ''))
		}
		return generateTypicalValue(param.type)
	})
}

function generateEdgeCaseInputs(parameters: FunctionParameter[]): any[] {
	return parameters.map(param => {
		const baseType = param.type.replace(/\[\]$/, '')
		return generateEdgeCaseValue(baseType)
	})
}

function generateNullTests(
	name: string,
	parameters: FunctionParameter[]
): TestCase[] {
	const tests: TestCase[] = []
	const nonOptionalParams = parameters.filter(p => !p.isOptional)

	if (nonOptionalParams.length === 0) return tests

	// Test with null values
	const nullInputs = parameters.map(param =>
		param.isOptional ? generateTypicalValue(param.type) : null
	)

	tests.push({
		name: 'null_inputs',
		description: `${name} handles null input values`,
		input: nullInputs,
		shouldThrow: true,
		expectedError: 'TypeError',
	})

	// Test with undefined values
	const undefinedInputs = parameters.map(param =>
		param.isOptional ? generateTypicalValue(param.type) : undefined
	)

	tests.push({
		name: 'undefined_inputs',
		description: `${name} handles undefined input values`,
		input: undefinedInputs,
		shouldThrow: true,
		expectedError: 'TypeError',
	})

	return tests
}

function generateBoundaryTests(
	name: string,
	parameters: FunctionParameter[]
): TestCase[] {
	const tests: TestCase[] = []

	for (let i = 0; i < parameters.length; i++) {
		const param = parameters[i]
		const boundaryValues = getBoundaryValues(param.type)

		for (const [valueName, value] of Object.entries(boundaryValues)) {
			const inputs = parameters.map((p, idx) =>
				idx === i ? value : generateTypicalValue(p.type)
			)

			tests.push({
				name: `boundary_${param.name}_${valueName}`,
				description: `${name} handles ${valueName.replaceAll('_', ' ')} value for ${param.name}`,
				input: inputs,
				shouldThrow:
					valueName.includes('infinity') ||
					valueName.includes('not_a_number'),
			})
		}
	}

	return tests
}

function generateMalformedInputTests(
	name: string,
	parameters: FunctionParameter[]
): TestCase[] {
	const tests: TestCase[] = []

	for (let i = 0; i < parameters.length; i++) {
		const param = parameters[i]
		const malformedValue = generateMalformedValue(param.type)

		if (malformedValue !== null) {
			const inputs = parameters.map((p, idx) =>
				idx === i ? malformedValue : generateTypicalValue(p.type)
			)

			tests.push({
				name: `malformed_${param.name}`,
				description: `${name} handles malformed ${param.type} for ${param.name}`,
				input: inputs,
				shouldThrow: true,
				expectedError: 'TypeError',
			})
		}
	}

	return tests
}

function generateEmptyInputs(parameters: FunctionParameter[]): any[] {
	return parameters.map(param => generateEmptyValue(param.type))
}

function generateLargeValueTests(
	name: string,
	parameters: FunctionParameter[]
): TestCase[] {
	const tests: TestCase[] = []

	for (let i = 0; i < parameters.length; i++) {
		const param = parameters[i]
		const largeValue = generateLargeValue(param.type)

		if (largeValue !== null) {
			const inputs = parameters.map((p, idx) =>
				idx === i ? largeValue : generateTypicalValue(p.type)
			)

			tests.push({
				name: `large_${param.name}`,
				description: `${name} handles large ${param.type} for ${param.name}`,
				input: inputs,
			})
		}
	}

	return tests
}

// All the value generation helper functions remain the same as in the original
function generateTypicalValue(type: string): any {
	const normalizedType = type.toLowerCase().trim()

	if (normalizedType.includes('string')) return 'test'
	if (normalizedType.includes('number')) return 3
	if (normalizedType.includes('boolean')) return true
	if (normalizedType.includes('array') || normalizedType.includes('[]'))
		return [1, 2, 3]
	if (normalizedType.includes('object') && !normalizedType.includes('[]'))
		return { key: 'value' }
	if (normalizedType.includes('date')) return new Date()
	if (normalizedType.includes('regexp')) return /test/
	if (normalizedType.includes('function')) return () => {}

	return 'defaultValue'
}

function generateEdgeCaseValue(type: string): any {
	const normalizedType = type.toLowerCase().trim()

	if (normalizedType.includes('string')) return 'test🌟多字节文本'
	if (normalizedType.includes('number')) return 1
	if (normalizedType.includes('boolean')) return false
	if (normalizedType.includes('array') || normalizedType.includes('[]'))
		return []
	if (normalizedType.includes('object') && !normalizedType.includes('[]'))
		return {}
	if (normalizedType.includes('date')) return new Date('invalid')
	if (normalizedType.includes('regexp')) return /(?:)/

	return null
}

function getBoundaryValues(type: string): Record<string, any> {
	const normalizedType = type.toLowerCase().trim()

	if (normalizedType.includes('number')) {
		return {
			zero: 0,
			negative_one: -1,
			positive_infinity: Number.POSITIVE_INFINITY,
			negative_infinity: Number.NEGATIVE_INFINITY,
			not_a_number: NaN,
			negative_zero: -0,
		}
	}

	if (normalizedType.includes('string')) {
		return {
			empty_string: '',
			very_long_string: 'a'.repeat(10000),
			unicode_string: '🌟👨‍💻🚀',
			null_char: '\0',
			newline_string: 'line1\nline2',
		}
	}

	if (normalizedType.includes('array') || normalizedType.includes('[]')) {
		return {
			empty_array: [],
			single_element: [1],
			large_array: new Array(1000).fill(0).map((_, i) => i),
		}
	}

	return {}
}

function generateMalformedValue(type: string): any {
	const normalizedType = type.toLowerCase().trim()

	if (normalizedType.includes('number')) return 'not_a_number'
	if (normalizedType.includes('string')) return 123
	if (normalizedType.includes('boolean')) return 'true'
	if (normalizedType.includes('array') || normalizedType.includes('[]'))
		return 'not_an_array'
	if (normalizedType.includes('object') && !normalizedType.includes('[]'))
		return 'not_an_object'
	if (normalizedType.includes('date')) return 'not_a_date'
	if (normalizedType.includes('function')) return 'not_a_function'

	return null
}

function generateEmptyValue(type: string): any {
	const normalizedType = type.toLowerCase().trim()

	if (normalizedType.includes('string')) return ''
	if (normalizedType.includes('number')) return 0
	if (normalizedType.includes('boolean')) return false
	if (normalizedType.includes('array') || normalizedType.includes('[]'))
		return []
	if (normalizedType.includes('object') && !normalizedType.includes('[]'))
		return {}
	if (normalizedType.includes('date')) return new Date(0)

	return null
}

function generateLargeValue(type: string): any {
	const normalizedType = type.toLowerCase().trim()

	if (normalizedType.includes('number')) return 1000
	if (normalizedType.includes('string')) return 'x'.repeat(100000)
	if (normalizedType.includes('array') || normalizedType.includes('[]')) {
		return new Array(10000).fill(0).map((_, i) => i)
	}
	if (normalizedType.includes('object') && !normalizedType.includes('[]')) {
		const obj: any = {}
		for (let i = 0; i < 1000; i++) {
			obj[`key${i}`] = `value${i}`
		}
		return obj
	}

	return null
}
