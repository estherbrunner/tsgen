import { test, expect, describe } from 'bun:test';
import { runTests } from '../src/server/test-runner';
import {
  extractFunctionSignature,
  generateGenericTests,
} from '../src/server/generic-test-generator';
import { generateFallbackTests } from '../src/server/llm-test-enhancer';

describe('Comprehensive Test System', () => {
  describe('Function Signature Extraction', () => {
    test('should extract signature from regular function', () => {
      const code = `function add(a: number, b: number): number {
        return a + b;
      }`;

      const signature = extractFunctionSignature(code);

      expect(signature.name).toBe('add');
      expect(signature.parameters).toHaveLength(2);
      expect(signature.parameters[0].name).toBe('a');
      expect(signature.parameters[0].type).toBe('number');
      expect(signature.returnType).toBe('number');
      expect(signature.isAsync).toBe(false);
    });

    test('should extract signature from arrow function', () => {
      const code = `const multiply = (x: number, y: number): number => {
        return x * y;
      }`;

      const signature = extractFunctionSignature(code);

      expect(signature.name).toBe('multiply');
      expect(signature.parameters).toHaveLength(2);
      expect(signature.returnType).toBe('number');
    });

    test('should handle async functions', () => {
      const code = `async function fetchData(url: string): Promise<any> {
        const response = await fetch(url);
        return response.json();
      }`;

      const signature = extractFunctionSignature(code);

      expect(signature.name).toBe('fetchData');
      expect(signature.isAsync).toBe(true);
      expect(signature.returnType).toBe('any');
    });

    test('should extract @throws annotations', () => {
      const code = `/**
       * @throws {TypeError} When input is invalid
       * @throws {RangeError} When value is out of range
       */
      function validate(input: any): boolean {
        return true;
      }`;

      const signature = extractFunctionSignature(code);

      expect(signature.throwsTypes).toContain('TypeError');
      expect(signature.throwsTypes).toContain('RangeError');
    });

    test('should handle optional parameters', () => {
      const code = `function greet(name: string, prefix?: string): string {
        return prefix ? prefix + name : name;
      }`;

      const signature = extractFunctionSignature(code);

      expect(signature.parameters).toHaveLength(2);
      expect(signature.parameters[0].isOptional).toBe(false);
      expect(signature.parameters[1].isOptional).toBe(true);
    });
  });

  describe('Generic Test Generation', () => {
    test('should generate comprehensive generic tests', () => {
      const signature = {
        name: 'processArray',
        parameters: [
          { name: 'arr', type: 'number[]', isOptional: false, isRest: false },
        ],
        returnType: 'number',
        isAsync: false,
      };

      const tests = generateGenericTests(signature);

      expect(tests.length).toBeGreaterThan(5);
      expect(tests.some(t => t.name === 'normal_execution')).toBe(true);
      expect(tests.some(t => t.name === 'edge_case_values')).toBe(true);
      expect(tests.some(t => t.name === 'empty_values')).toBe(true);
    });

    test('should generate null/undefined tests for non-optional params', () => {
      const signature = {
        name: 'required',
        parameters: [
          { name: 'value', type: 'string', isOptional: false, isRest: false },
        ],
        returnType: 'string',
        isAsync: false,
      };

      const tests = generateGenericTests(signature);

      expect(tests.some(t => t.name === 'null_inputs')).toBe(true);
      expect(tests.some(t => t.name === 'undefined_inputs')).toBe(true);
    });

    test('should generate boundary tests for numbers', () => {
      const signature = {
        name: 'calculate',
        parameters: [
          { name: 'num', type: 'number', isOptional: false, isRest: false },
        ],
        returnType: 'number',
        isAsync: false,
      };

      const tests = generateGenericTests(signature);

      expect(tests.some(t => t.name.includes('boundary'))).toBe(true);
    });
  });

  describe('LLM Test Enhancement', () => {
    test('should generate fallback tests when LLM fails', () => {
      const signature = {
        name: 'add',
        parameters: [
          { name: 'a', type: 'number', isOptional: false, isRest: false },
          { name: 'b', type: 'number', isOptional: false, isRest: false },
        ],
        returnType: 'number',
        isAsync: false,
      };

      const fallbackTests = generateFallbackTests('add two numbers', signature);

      expect(fallbackTests.length).toBeGreaterThan(0);
      expect(fallbackTests[0].reasoning).toBeDefined();
      expect(fallbackTests[0].input).toHaveLength(2);
    });
  });

  describe('Full Test Integration', () => {
    test('should run comprehensive tests for simple function', async () => {
      const functionCode = `function add(a: number, b: number): number {
        return a + b;
      }`;

      const result = await runTests(functionCode, 'add two numbers together', [
        'input 2, 3 should return 5',
      ]);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.label).toContain('add');
      expect(result.totalExecutionTime).toBeGreaterThan(0);
      expect(Array.isArray(result.tests)).toBe(true);
      expect(result.tests.length).toBeGreaterThan(5); // Should have generic + user tests
    });

    test('should handle complex function with array processing', async () => {
      const functionCode = `function processNumbers(numbers: number[]): { sum: number; average: number } {
        const sum = numbers.reduce((acc, num) => acc + num, 0);
        return { sum, average: sum / numbers.length };
      }`;

      const result = await runTests(
        functionCode,
        'process an array of numbers to get sum and average',
        ['input [1, 2, 3, 4] should return {sum: 10, average: 2.5}']
      );

      expect(result).toBeDefined();
      expect(result.tests.length).toBeGreaterThan(8); // More comprehensive tests

      // Check that we have different types of tests
      const testNames = result.tests.map(t => t.name);
      expect(testNames.some(name => name.includes('normal_execution'))).toBe(
        true
      );
      expect(testNames.some(name => name.includes('empty_values'))).toBe(true);
      expect(testNames.some(name => name.includes('user_test'))).toBe(true);
    });

    test('should handle function with error throwing', async () => {
      const functionCode = `/**
       * @throws {Error} When divisor is zero
       */
      function divide(dividend: number, divisor: number): number {
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        return dividend / divisor;
      }`;

      const result = await runTests(
        functionCode,
        'divide two numbers with error handling',
        ['input 10, 2 should return 5', 'input 5, 0 should throw error']
      );

      expect(result).toBeDefined();
      expect(result.tests.length).toBeGreaterThan(0);
    });

    test('should provide detailed test results', async () => {
      const functionCode = `function isEven(num: number): boolean {
        return num % 2 === 0;
      }`;

      const result = await runTests(
        functionCode,
        'check if a number is even',
        []
      );

      expect(result).toBeDefined();

      // Check test result structure
      for (const test of result.tests) {
        expect(test.name).toBeDefined();
        expect(test.description).toBeDefined();
        expect(typeof test.passed).toBe('boolean');
        expect(test.status).toMatch(/^(passed|failed|error|skipped|warning)$/);
        expect(test.message).toBeDefined();
        expect(typeof test.executionTime).toBe('number');
      }
    });

    test('should handle malformed function gracefully', async () => {
      const brokenCode = `function broken( {
        // Syntax error - missing parameter
        return 42;
      }`;

      const result = await runTests(
        brokenCode,
        'broken function with syntax error',
        []
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.tests[0].status).toBe('error');
    });

    test('should generate performance metrics', async () => {
      const functionCode = `function square(n: number): number {
        return n * n;
      }`;

      const result = await runTests(
        functionCode,
        'calculate square of a number',
        ['input 5 should return 25']
      );

      expect(result.totalExecutionTime).toBeGreaterThan(0);

      for (const test of result.tests) {
        expect(test.executionTime).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle string processing functions', async () => {
      const functionCode = `function reverseWords(sentence: string): string {
        return sentence.split(' ').map(word =>
          word.split('').reverse().join('')
        ).join(' ');
      }`;

      const result = await runTests(
        functionCode,
        'reverse each word in a sentence',
        ['input "hello world" should return "olleh dlrow"']
      );

      expect(result).toBeDefined();
      expect(result.tests.some(t => t.name.includes('user_test'))).toBe(true);

      // Should handle multibyte characters in generic tests
      const testDescriptions = result.tests.map(t => t.description);
      expect(
        testDescriptions.some(
          desc =>
            desc.includes('multibyte') ||
            desc.includes('unicode') ||
            desc.includes('edge')
        )
      ).toBe(true);
    });

    test('should detect and report linter warnings', async () => {
      const functionCode = `function unusedFunction(): string {
        console.log('This should trigger warnings');
        return 'test';
      }`;

      const result = await runTests(
        functionCode,
        'function with linter warnings',
        []
      );

      expect(result).toBeDefined();
      expect(result.hasWarnings).toBeDefined();
      
      // The function should still work (success) but have warnings
      if (result.linterWarnings) {
        expect(result.linterWarnings.length).toBeGreaterThan(0);
        const warningMessages = result.linterWarnings.map(w => w.message);
        expect(warningMessages.some(msg => 
          msg.includes('unused') || msg.includes('console')
        )).toBe(true);
      }
    });
  });
});
