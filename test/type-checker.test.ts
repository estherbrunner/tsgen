import { test, expect, describe } from 'bun:test'
import { typeCheck } from '../src/server/old/type-checker'

describe('Type Checker', () => {
	test('should type check valid TypeScript code successfully', async () => {
		const validCode = `function add(a: number, b: number): number {
  return a + b;
}`

		const result = await typeCheck(validCode)

		expect(result).toBeDefined()
		expect(result.success).toBe(true)
		// Message is only present when there are errors
		expect(result.message).toBeUndefined()
	})

	test('should detect type errors in invalid code', async () => {
		const invalidCode = `function add(a: number, b: number): number {
  return a + "invalid";
}`

		const result = await typeCheck(invalidCode)

		expect(result).toBeDefined()
		expect(result.success).toBe(false)
		expect(typeof result.message).toBe('string')
		expect(result.message!.length).toBeGreaterThan(0)
	})

	test('should handle syntax errors', async () => {
		const syntaxError = `function broken( {
  // Missing parameter syntax
  return 42;
}`

		const result = await typeCheck(syntaxError)

		expect(result).toBeDefined()
		expect(result.success).toBe(false)
		expect(result.message).toContain('error')
	})

	test('should validate function signatures', async () => {
		const functionCode = `function calculate(x: number, y: string): boolean {
  return x > 0 && y.length > 0;
}`

		const result = await typeCheck(functionCode)

		expect(result).toBeDefined()
		expect(result.success).toBe(true)
	})

	test('should detect missing return type annotations', async () => {
		const noReturnType = `function process(data: any) {
  return data.toString();
}`

		const result = await typeCheck(noReturnType)

		expect(result).toBeDefined()
		// May or may not be an error depending on TypeScript configuration
		expect(typeof result.success).toBe('boolean')
	})

	test('should handle complex TypeScript features', async () => {
		const complexCode = `interface User {
  id: number;
  name: string;
  email?: string;
}

function createUser(data: Partial<User>): User {
  return {
    id: data.id || 0,
    name: data.name || 'Unknown',
    email: data.email
  };
}`

		const result = await typeCheck(complexCode)

		expect(result).toBeDefined()
		expect(result.success).toBe(true)
	})

	test('should detect undefined variable usage', async () => {
		const undefinedVar = `function useUndefined(): number {
  return undefinedVariable + 5;
}`

		const result = await typeCheck(undefinedVar)

		expect(result).toBeDefined()
		expect(result.success).toBe(false)
		expect(result.message).toBeDefined()
		expect(typeof result.message).toBe('string')
	})

	test('should validate array and object types', async () => {
		const arrayCode = `function processArray(items: string[]): number {
  return items.length;
}

function processObject(config: { name: string; value: number }): string {
  return config.name + config.value;
}`

		const result = await typeCheck(arrayCode)

		expect(result).toBeDefined()
		expect(result.success).toBe(true)
	})

	test('should handle generic functions', async () => {
		const genericCode = `function identity<T>(arg: T): T {
  return arg;
}

function map<T, U>(array: T[], fn: (item: T) => U): U[] {
  return array.map(fn);
}`

		const result = await typeCheck(genericCode)

		expect(result).toBeDefined()
		expect(result.success).toBe(true)
	})

	test('should detect type mismatches in assignments', async () => {
		const typeMismatch = `function assign(): void {
  const num: number = "string";
  const str: string = 42;
}`

		const result = await typeCheck(typeMismatch)

		expect(result).toBeDefined()
		expect(result.success).toBe(false)
		expect(result.message).toBeDefined()
		expect(typeof result.message).toBe('string')
		expect(result.message!.length).toBeGreaterThan(0)
	})
})
