/**
 * Generic test generator for TypeScript functions
 * Generates comprehensive tests based on function signature and common edge cases
 */

import { TestCaseResult } from '../shared/types';

export interface FunctionSignature {
  name: string;
  parameters: Parameter[];
  returnType: string;
  throwsTypes?: string[];
  isAsync: boolean;
}

export interface Parameter {
  name: string;
  type: string;
  isOptional: boolean;
  isRest: boolean;
}

export interface GenericTestCase {
  name: string;
  description: string;
  input: any[];
  shouldThrow?: boolean;
  expectedError?: string;
}

/**
 * Extract function signature from TypeScript code
 */
export function extractFunctionSignature(code: string): FunctionSignature {
  // Remove comments and normalize whitespace
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  // Extract function name
  const functionMatch = cleanCode.match(
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/
  );
  const arrowMatch = cleanCode.match(
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/
  );
  const name = functionMatch?.[1] || arrowMatch?.[1] || 'unknownFunction';

  // Check if async
  const isAsync = /(?:async\s+function|=\s*async\s*\()/.test(cleanCode);

  // Extract parameters
  const paramMatch = cleanCode.match(/\(([^)]*)\)/);
  const paramString = paramMatch?.[1] || '';
  const parameters = parseParameters(paramString);

  // Extract return type
  const returnTypeMatch = cleanCode.match(/\):\s*([^{=]+)/);
  const returnType =
    returnTypeMatch?.[1]?.trim().replace(/^Promise<|>$/g, '') || 'any';

  // Extract @throws annotations from JSDoc
  const throwsMatches = code.match(/@throws\s+\{([^}]+)\}/g) || [];
  const throwsTypes = throwsMatches.map(match => {
    const typeMatch = match.match(/@throws\s+\{([^}]+)\}/);
    return typeMatch?.[1] || 'Error';
  });

  return {
    name,
    parameters,
    returnType,
    throwsTypes,
    isAsync,
  };
}

/**
 * Parse parameter string into Parameter objects
 */
function parseParameters(paramString: string): Parameter[] {
  if (!paramString.trim()) return [];

  const params: Parameter[] = [];
  const paramParts = paramString.split(',').map(p => p.trim());

  for (const part of paramParts) {
    if (!part) continue;

    const isRest = part.startsWith('...');
    const cleanPart = part.replace(/^\.\.\./, '');

    const [nameWithOptional, typeWithDefault] = cleanPart
      .split(':')
      .map(s => s?.trim());
    if (!nameWithOptional) continue;

    const isOptional =
      nameWithOptional.includes('?') || typeWithDefault?.includes('=');
    const name = nameWithOptional.replace('?', '');

    let type = 'any';
    if (typeWithDefault) {
      const typeMatch = typeWithDefault.match(/^([^=]+)/);
      type = typeMatch?.[1]?.trim() || 'any';
    }

    params.push({
      name,
      type,
      isOptional,
      isRest,
    });
  }

  return params;
}

/**
 * Generate generic test cases for a function
 */
export function generateGenericTests(
  signature: FunctionSignature
): GenericTestCase[] {
  const tests: GenericTestCase[] = [];

  // Test 1: Normal execution with typical values
  tests.push({
    name: 'normal_execution',
    description: `${signature.name} executes with typical input values`,
    input: generateTypicalInputs(signature.parameters),
  });

  // Test 2: Edge case values
  tests.push({
    name: 'edge_case_values',
    description: `${signature.name} handles edge case input values`,
    input: generateEdgeCaseInputs(signature.parameters),
  });

  // Test 3: Null/undefined inputs (if not optional)
  const nullTests = generateNullTests(signature.name, signature.parameters);
  tests.push(...nullTests);

  // Test 4: Type boundary tests
  const boundaryTests = generateBoundaryTests(
    signature.name,
    signature.parameters
  );
  tests.push(...boundaryTests);

  // Test 5: Malformed input tests
  const malformedTests = generateMalformedInputTests(
    signature.name,
    signature.parameters
  );
  tests.push(...malformedTests);

  // Test 6: Empty/zero values
  tests.push({
    name: 'empty_values',
    description: `${signature.name} handles empty/zero values`,
    input: generateEmptyInputs(signature.parameters),
  });

  // Test 7: Large values (if numeric/array types)
  const largeValueTests = generateLargeValueTests(
    signature.name,
    signature.parameters
  );
  if (largeValueTests.length > 0) {
    tests.push(...largeValueTests);
  }

  return tests;
}

/**
 * Generate typical input values for parameters
 */
function generateTypicalInputs(parameters: Parameter[]): any[] {
  return parameters.map(param => {
    if (param.isRest) {
      return generateTypicalValue(param.type.replace(/\[\]$/, ''));
    }
    return generateTypicalValue(param.type);
  });
}

/**
 * Generate edge case input values
 */
function generateEdgeCaseInputs(parameters: Parameter[]): any[] {
  return parameters.map(param => {
    const baseType = param.type.replace(/\[\]$/, '');
    return generateEdgeCaseValue(baseType);
  });
}

/**
 * Generate null/undefined tests for non-optional parameters
 */
function generateNullTests(
  name: string,
  parameters: Parameter[]
): GenericTestCase[] {
  const tests: GenericTestCase[] = [];

  const nonOptionalParams = parameters.filter(p => !p.isOptional);
  if (nonOptionalParams.length === 0) return tests;

  // Test with null values
  const nullInputs = parameters.map(param =>
    param.isOptional ? generateTypicalValue(param.type) : null
  );

  tests.push({
    name: 'null_inputs',
    description: `${name} handles null input values`,
    input: nullInputs,
    shouldThrow: true,
    expectedError: 'TypeError',
  });

  // Test with undefined values
  const undefinedInputs = parameters.map(param =>
    param.isOptional ? generateTypicalValue(param.type) : undefined
  );

  tests.push({
    name: 'undefined_inputs',
    description: `${name} handles undefined input values`,
    input: undefinedInputs,
    shouldThrow: true,
    expectedError: 'TypeError',
  });

  return tests;
}

/**
 * Generate boundary tests for different types
 */
function generateBoundaryTests(
  name: string,
  parameters: Parameter[]
): GenericTestCase[] {
  const tests: GenericTestCase[] = [];

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    const boundaryValues = getBoundaryValues(param.type);

    for (const [valueName, value] of Object.entries(boundaryValues)) {
      const inputs = parameters.map((p, idx) =>
        idx === i ? value : generateTypicalValue(p.type)
      );

      tests.push({
        name: `boundary_${param.name}_${valueName}`,
        description: `${name} handles ${valueName.replaceAll('_', ' ')} value for ${param.name}`,
        input: inputs,
        shouldThrow:
          valueName.includes('infinity') || valueName.includes('not_a_number'),
      });
    }
  }

  return tests;
}

/**
 * Generate malformed input tests
 */
function generateMalformedInputTests(
  name: string,
  parameters: Parameter[]
): GenericTestCase[] {
  const tests: GenericTestCase[] = [];

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    const malformedValue = generateMalformedValue(param.type);

    if (malformedValue !== null) {
      const inputs = parameters.map((p, idx) =>
        idx === i ? malformedValue : generateTypicalValue(p.type)
      );

      tests.push({
        name: `malformed_${param.name}`,
        description: `${name} handles malformed ${param.type} for ${param.name}`,
        input: inputs,
        shouldThrow: true,
        expectedError: 'TypeError',
      });
    }
  }

  return tests;
}

/**
 * Generate empty/zero input values
 */
function generateEmptyInputs(parameters: Parameter[]): any[] {
  return parameters.map(param => generateEmptyValue(param.type));
}

/**
 * Generate large value tests
 */
function generateLargeValueTests(
  name: string,
  parameters: Parameter[]
): GenericTestCase[] {
  const tests: GenericTestCase[] = [];

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    const largeValue = generateLargeValue(param.type);

    if (largeValue !== null) {
      const inputs = parameters.map((p, idx) =>
        idx === i ? largeValue : generateTypicalValue(p.type)
      );

      tests.push({
        name: `large_${param.name}`,
        description: `${name} handles large ${param.type} for ${param.name}`,
        input: inputs,
      });
    }
  }

  return tests;
}

/**
 * Generate typical value for a given type
 */
function generateTypicalValue(type: string): any {
  const normalizedType = type.toLowerCase().trim();

  if (normalizedType.includes('string')) return 'test';
  if (normalizedType.includes('number')) return 3;
  if (normalizedType.includes('boolean')) return true;
  if (normalizedType.includes('array') || normalizedType.includes('[]'))
    return [1, 2, 3];
  if (normalizedType.includes('object') && !normalizedType.includes('[]'))
    return { key: 'value' };
  if (normalizedType.includes('date')) return new Date();
  if (normalizedType.includes('regexp')) return /test/;
  if (normalizedType.includes('function')) return () => {};

  return 'defaultValue';
}

/**
 * Generate edge case value for a given type
 */
function generateEdgeCaseValue(type: string): any {
  const normalizedType = type.toLowerCase().trim();

  if (normalizedType.includes('string')) return 'test🌟多字节文本';
  if (normalizedType.includes('number')) return 1;
  if (normalizedType.includes('boolean')) return false;
  if (normalizedType.includes('array') || normalizedType.includes('[]'))
    return [];
  if (normalizedType.includes('object') && !normalizedType.includes('[]'))
    return {};
  if (normalizedType.includes('date')) return new Date('invalid');
  if (normalizedType.includes('regexp')) return /(?:)/;

  return null;
}

/**
 * Get boundary values for a type
 */
function getBoundaryValues(type: string): Record<string, any> {
  const normalizedType = type.toLowerCase().trim();

  if (normalizedType.includes('number')) {
    return {
      zero: 0,
      negative_one: -1,
      positive_infinity: Number.POSITIVE_INFINITY,
      negative_infinity: Number.NEGATIVE_INFINITY,
      not_a_number: NaN,
      negative_zero: -0,
    };
  }

  if (normalizedType.includes('string')) {
    return {
      empty_string: '',
      very_long_string: 'a'.repeat(10000),
      unicode_string: '🌟👨‍💻🚀',
      null_char: '\0',
      newline_string: 'line1\nline2',
    };
  }

  if (normalizedType.includes('array') || normalizedType.includes('[]')) {
    return {
      empty_array: [],
      single_element: [1],
      large_array: new Array(1000).fill(0).map((_, i) => i),
    };
  }

  return {};
}

/**
 * Generate malformed value for a type
 */
function generateMalformedValue(type: string): any {
  const normalizedType = type.toLowerCase().trim();

  if (normalizedType.includes('number')) return 'not_a_number';
  if (normalizedType.includes('string')) return 123;
  if (normalizedType.includes('boolean')) return 'true';
  if (normalizedType.includes('array') || normalizedType.includes('[]'))
    return 'not_an_array';
  if (normalizedType.includes('object') && !normalizedType.includes('[]'))
    return 'not_an_object';
  if (normalizedType.includes('date')) return 'not_a_date';
  if (normalizedType.includes('function')) return 'not_a_function';

  return null;
}

/**
 * Generate empty value for a type
 */
function generateEmptyValue(type: string): any {
  const normalizedType = type.toLowerCase().trim();

  if (normalizedType.includes('string')) return '';
  if (normalizedType.includes('number')) return 0;
  if (normalizedType.includes('boolean')) return false;
  if (normalizedType.includes('array') || normalizedType.includes('[]'))
    return [];
  if (normalizedType.includes('object') && !normalizedType.includes('[]'))
    return {};
  if (normalizedType.includes('date')) return new Date(0);

  return null;
}

/**
 * Generate large value for a type
 */
function generateLargeValue(type: string): any {
  const normalizedType = type.toLowerCase().trim();

  if (normalizedType.includes('number')) return 1000;
  if (normalizedType.includes('string')) return 'x'.repeat(100000);
  if (normalizedType.includes('array') || normalizedType.includes('[]')) {
    return new Array(10000).fill(0).map((_, i) => i);
  }
  if (normalizedType.includes('object') && !normalizedType.includes('[]')) {
    const obj: any = {};
    for (let i = 0; i < 1000; i++) {
      obj[`key${i}`] = `value${i}`;
    }
    return obj;
  }

  return null;
}
