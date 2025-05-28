/**
 * LLM-powered test enhancer for TypeScript functions
 * Uses LLM to generate specific test cases based on function purpose and signature
 */

import { FunctionSignature, GenericTestCase } from './generic-test-generator';

// LMStudio API configuration
const LMSTUDIO_BASE_URL = 'http://localhost:1234/v1';

export interface LLMTestCase {
  name: string;
  description: string;
  input: any[];
  expectedOutput?: any;
  shouldThrow?: boolean;
  expectedError?: string;
  reasoning: string;
}

export interface LLMTestEnhancementRequest {
  originalPrompt: string;
  functionCode: string;
  functionSignature: FunctionSignature;
  genericTests: GenericTestCase[];
}

/**
 * Get available models from LMStudio
 */
async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${LMSTUDIO_BASE_URL}/models`);
    if (!response.ok) {
      throw new Error(
        `LMStudio server returned ${response.status}: ${response.statusText}. Please ensure LMStudio is running and accessible at ${LMSTUDIO_BASE_URL}`
      );
    }
    const data = await response.json();
    const models = data.data?.map((model: any) => model.id) || [];
    if (models.length === 0) {
      throw new Error(
        'No models available in LMStudio. Please load a model in LMStudio first.'
      );
    }
    return models;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to LMStudio at ${LMSTUDIO_BASE_URL}. Please ensure LMStudio is running and accessible.`
      );
    }
    throw error;
  }
}

/**
 * Enhance generic tests with LLM-generated specific test cases
 */
export async function enhanceTestsWithLLM(
  request: LLMTestEnhancementRequest
): Promise<LLMTestCase[]> {
  try {
    // Set a timeout for the entire operation (shorter for tests)
    const timeoutMs = process.env.NODE_ENV === 'test' ? 1000 : 10000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM request timeout')), timeoutMs);
    });

    const llmPromise = (async () => {
      const models = await getAvailableModels();
      const modelToUse = models[0];

      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(request);

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
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.4,
          max_tokens: 2000,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `LMStudio API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const generatedContent = data.choices?.[0]?.message?.content;

      if (!generatedContent) {
        throw new Error('No test cases generated from LLM response');
      }

      return parseGeneratedTestCases(
        generatedContent,
        request.functionSignature
      );
    })();

    return await Promise.race([llmPromise, timeoutPromise]);
  } catch (error) {
    console.warn('LLM test enhancement failed:', error);
    // Return fallback tests when LLM fails
    return generateFallbackTests(
      request.originalPrompt,
      request.functionSignature
    );
  }
}

/**
 * Enhanced tests with fast fallback for testing environments
 */
export async function enhanceTestsWithLLMOrFallback(
  request: LLMTestEnhancementRequest
): Promise<LLMTestCase[]> {
  // In test environment, skip LLM and use fallback immediately
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_LLM === 'true') {
    return generateFallbackTests(
      request.originalPrompt,
      request.functionSignature
    );
  }

  return enhanceTestsWithLLM(request);
}

/**
 * Build system prompt for test case generation
 */
function buildSystemPrompt(): string {
  return `You are an expert software testing engineer specializing in TypeScript. Your task is to generate comprehensive, specific test cases for TypeScript functions based on their purpose and implementation.

INSTRUCTIONS:
1. Analyze the function's intended purpose from the original user prompt
2. Review the function signature and implementation
3. Generate 5-8 specific test cases that go beyond generic testing
4. Focus on domain-specific logic, business rules, and edge cases unique to this function
5. Consider the function's actual behavior and potential failure modes

OUTPUT FORMAT:
Return a JSON array of test cases. Each test case must have this exact structure:
[
  {
    "name": "descriptive_test_name",
    "description": "Clear description of what this test validates",
    "input": [param1, param2, ...],
    "expectedOutput": expected_result_or_null,
    "shouldThrow": boolean,
    "expectedError": "ErrorType" or null,
    "reasoning": "Why this test case is important for this specific function"
  }
]

GUIDELINES:
- Use realistic, domain-appropriate test data
- Include both positive and negative test cases
- Test business logic edge cases specific to the function's purpose
- Consider real-world usage scenarios
- Ensure input arrays match the function's parameter count exactly
- Use proper JSON syntax with no trailing commas
- Include null for expectedOutput if testing for exceptions
- Provide clear reasoning for each test case

AVOID:
- Generic type checking (already covered by generic tests)
- Basic null/undefined tests (already covered)
- Simple boundary value tests (already covered)
- Tests that duplicate the generic test suite`;
}

/**
 * Build user prompt for specific function
 */
function buildUserPrompt(request: LLMTestEnhancementRequest): string {
  const { originalPrompt, functionCode, functionSignature, genericTests } =
    request;

  const parameterInfo = functionSignature.parameters
    .map(p => `${p.name}: ${p.type}${p.isOptional ? ' (optional)' : ''}`)
    .join(', ');

  return `ORIGINAL USER REQUEST:
"${originalPrompt}"

FUNCTION SIGNATURE:
${functionSignature.name}(${parameterInfo}): ${functionSignature.returnType}

FUNCTION IMPLEMENTATION:
\`\`\`typescript
${functionCode}
\`\`\`

EXISTING GENERIC TESTS (don't duplicate these):
${genericTests.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Generate specific test cases that validate the unique logic and requirements of this function. Focus on the function's actual purpose and domain-specific behavior.`;
}

/**
 * Parse generated test cases from LLM response
 */
function parseGeneratedTestCases(
  content: string,
  signature: FunctionSignature
): LLMTestCase[] {
  try {
    // Clean the content first
    let cleanContent = content.trim();

    // Extract JSON from the response with multiple patterns
    let jsonMatch = cleanContent.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      // Try to find JSON in code blocks
      const codeBlockMatch = cleanContent.match(
        /```(?:json)?\s*(\[[\s\S]*?\])\s*```/
      );
      if (codeBlockMatch) {
        jsonMatch = [codeBlockMatch[1]];
      }
    }

    if (!jsonMatch) {
      throw new Error('No JSON array found in LLM response');
    }

    let jsonString = jsonMatch[0];

    // Clean up common JSON issues
    jsonString = jsonString
      .replace(/,\s*}/g, '}') // Remove trailing commas in objects
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .replace(/'/g, '"') // Replace single quotes with double quotes
      .replace(/(\w+):/g, '"$1":') // Quote unquoted keys
      .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}\]])/g, ': "$1"$2'); // Quote unquoted string values

    let parsedTests;
    try {
      parsedTests = JSON.parse(jsonString);
    } catch (parseError) {
      // If JSON parsing fails, try to extract individual test objects
      console.warn(
        'JSON parsing failed, attempting manual extraction:',
        parseError
      );
      parsedTests = extractTestObjectsManually(content);
    }

    if (!Array.isArray(parsedTests)) {
      throw new Error('LLM response is not an array');
    }

    // Validate and sanitize each test case
    const validTests: LLMTestCase[] = [];

    for (let i = 0; i < parsedTests.length; i++) {
      const test = parsedTests[i];

      if (!isValidTestCase(test, signature)) {
        console.warn(`Skipping invalid test case ${i}:`, test);
        continue;
      }

      validTests.push({
        name: sanitizeString(test.name),
        description: sanitizeString(test.description),
        input: Array.isArray(test.input) ? test.input : [],
        expectedOutput: test.expectedOutput,
        shouldThrow: Boolean(test.shouldThrow),
        expectedError: test.expectedError || undefined,
        reasoning: sanitizeString(test.reasoning),
      });
    }

    return validTests;
  } catch (error) {
    console.warn('Failed to parse LLM test cases:', error);
    return [];
  }
}

/**
 * Validate that a test case has the required structure
 */
function isValidTestCase(test: any, signature: FunctionSignature): boolean {
  if (!test || typeof test !== 'object') return false;

  // Required fields
  if (!test.name || typeof test.name !== 'string') return false;
  if (!test.description || typeof test.description !== 'string') return false;
  if (!test.reasoning || typeof test.reasoning !== 'string') return false;

  // Input validation
  if (!Array.isArray(test.input)) return false;

  // Input length should match function parameters (accounting for optional params)
  const requiredParams = signature.parameters.filter(p => !p.isOptional).length;
  const totalParams = signature.parameters.length;

  if (test.input.length < requiredParams || test.input.length > totalParams) {
    return false;
  }

  // Boolean fields
  if (test.shouldThrow !== undefined && typeof test.shouldThrow !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Sanitize string values to prevent injection
 */
function sanitizeString(value: any): string {
  if (typeof value !== 'string') return String(value);

  return value
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/[`${}]/g, '') // Remove template literal chars
    .trim()
    .slice(0, 500); // Limit length
}

/**
 * Manually extract test objects when JSON parsing fails
 */
function extractTestObjectsManually(content: string): any[] {
  const tests: any[] = [];

  // Look for test object patterns
  const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  const matches = content.match(objectPattern);

  if (!matches) return tests;

  for (const match of matches) {
    try {
      // Try to create a minimal valid test object
      const test = {
        name: 'extracted_test',
        description: 'Manually extracted test',
        input: [],
        reasoning: 'Extracted from malformed LLM response',
      };

      // Extract name if possible
      const nameMatch = match.match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch) test.name = nameMatch[1];

      // Extract description if possible
      const descMatch = match.match(/"description"\s*:\s*"([^"]+)"/);
      if (descMatch) test.description = descMatch[1];

      tests.push(test);
    } catch (e) {
      // Skip this object if we can't parse it
      continue;
    }
  }

  return tests;
}

/**
 * Generate fallback test cases if LLM fails
 */
export function generateFallbackTests(
  _originalPrompt: string,
  signature: FunctionSignature
): LLMTestCase[] {
  const functionName = signature.name;

  // Create basic functional tests based on common patterns
  const tests: LLMTestCase[] = [];

  // Test with typical values
  if (signature.parameters.length > 0) {
    tests.push({
      name: 'functional_typical_case',
      description: `Test ${functionName} with typical input values`,
      input: signature.parameters.map(p => getTypicalValueForType(p.type)),
      reasoning: 'Validates basic functionality with expected input types',
    });
  }

  // Test empty inputs if function accepts them
  if (
    signature.parameters.some(
      p => p.type.includes('array') || p.type.includes('string')
    )
  ) {
    tests.push({
      name: 'functional_empty_inputs',
      description: `Test ${functionName} with empty inputs`,
      input: signature.parameters.map(p => getEmptyValueForType(p.type)),
      reasoning: 'Validates handling of empty but valid inputs',
    });
  }

  // Test return type consistency
  tests.push({
    name: 'return_type_consistency',
    description: `Verify ${functionName} returns expected type`,
    input: signature.parameters.map(p => getTypicalValueForType(p.type)),
    reasoning: 'Ensures function returns value matching declared return type',
  });

  return tests;
}

/**
 * Get typical value for a given type string
 */
function getTypicalValueForType(type: string): any {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('string')) return 'test';
  if (normalizedType.includes('number')) return 3;
  if (normalizedType.includes('boolean')) return true;
  if (normalizedType.includes('array') || normalizedType.includes('[]'))
    return [1, 2, 3];
  if (normalizedType.includes('object')) return { key: 'value' };
  if (normalizedType.includes('date')) return new Date();

  return 'defaultValue';
}

/**
 * Get empty value for a given type string
 */
function getEmptyValueForType(type: string): any {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('string')) return '';
  if (normalizedType.includes('number')) return 0;
  if (normalizedType.includes('boolean')) return false;
  if (normalizedType.includes('array') || normalizedType.includes('[]'))
    return [];
  if (normalizedType.includes('object')) return {};

  return null;
}
