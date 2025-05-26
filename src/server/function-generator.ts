/**
 * Function generator for TypeScript code
 * Handles the actual code generation from natural language prompts using LMStudio LLM API
 */

import { FunctionRequest } from '../shared/types';
import * as prettier from 'prettier';

// LMStudio API configuration
const LMSTUDIO_BASE_URL = 'http://localhost:1234/v1';

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
 * Generate a TypeScript function from a natural language prompt using LMStudio LLM
 *
 * @param prompt - Natural language description of the function to create
 * @param options - Optional configuration for the function generation (ignored, uses defaults)
 * @returns The generated TypeScript code as a string
 */
export async function generateFunction(
  prompt: string,
  options: FunctionRequest['options'] = {}
): Promise<string> {
  try {
    // Get available models - this will throw if LMStudio is not available
    const models = await getAvailableModels();
    const modelToUse = models[0];

    // Build the system prompt with standard high-quality options
    const systemPrompt = buildSystemPrompt();

    // Build the user prompt
    const userPrompt = buildUserPrompt(prompt);

    // Call LMStudio API
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
        temperature: 0.3,
        max_tokens: 1000,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `LMStudio API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const generatedCode = data.choices?.[0]?.message?.content;

    if (!generatedCode) {
      throw new Error('No code generated from LLM response');
    }

    // Clean up the generated code
    const cleanedCode = cleanGeneratedCode(generatedCode);

    // Format the code with Prettier
    return await formatGeneratedCode(cleanedCode);
  } catch (error) {
    if (error instanceof Error) {
      throw error; // Re-throw with original message for better error reporting
    }
    throw new Error(`Error generating function with LLM: ${error}`);
  }
}

/**
 * Build system prompt with standardized high-quality options
 */
function buildSystemPrompt(): string {
  return `You are an expert TypeScript developer. Generate clean, well-structured TypeScript functions based on user requirements.

STANDARDS (ALWAYS APPLY):
- Target version: ESNext
- Programming style: Functional programming (pure functions, immutability where possible)
- Type strictness: Strict TypeScript types (no "any" unless absolutely necessary)
- JSDoc comments: ALWAYS include comprehensive JSDoc with @param, @returns, and @throws
- Complexity level: Low to medium (prefer readable, maintainable code)
- Error handling: Include proper error handling with specific @throws annotations

MANDATORY JSDoc FORMAT:
/**
 * Function description
 * @param {type} paramName - Description
 * @returns {type} Description
 * @throws {ErrorType} When specific condition occurs
 */

GUIDELINES:
1. Write only the function, no additional explanation
2. Use proper TypeScript syntax and strict types
3. Follow functional programming patterns where possible
4. ALWAYS include @throws JSDoc for any error conditions
5. Use descriptive parameter and variable names
6. Include proper input validation and error handling
7. Return only the function code, no markdown formatting
8. Prefer immutable operations and pure functions
9. Use const assertions and readonly types where appropriate`;
}

/**
 * Build user prompt for the LLM
 */
function buildUserPrompt(prompt: string): string {
  return `Create a TypeScript function that: ${prompt}

REQUIREMENTS:
- Include comprehensive JSDoc comments with @param, @returns, and @throws annotations
- Use functional programming patterns where possible (pure functions, immutability)
- Use strict TypeScript types with no "any" types unless absolutely necessary
- Include proper error handling and validation
- Document all possible error conditions with @throws JSDoc comments
- Follow ESNext standards and best practices

Remember: ALWAYS include @throws JSDoc annotations for any error conditions the function might encounter.`;
}

/**
 * Clean up generated code by removing markdown formatting and extra text
 */
function cleanGeneratedCode(code: string): string {
  // Remove markdown code blocks
  code = code
    .replace(/```(?:typescript|ts|javascript|js)?\s*\n?/g, '')
    .replace(/```\s*$/g, '');

  // Split into lines for processing
  const lines = code.split('\n');

  // Find the start of actual code (JSDoc or function)
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.startsWith('/**') ||
      line.startsWith('function ') ||
      line.match(/^(export\s+)?(async\s+)?(const|let|var)\s+\w+/) ||
      line.startsWith('export function') ||
      line.startsWith('interface ') ||
      line.startsWith('type ')
    ) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    // No clear function start found, return cleaned original
    return code.trim();
  }

  // Extract from start to end of function
  const codeLines = lines.slice(startIndex);

  // Find the end of the function with improved logic
  let braceCount = 0;
  let parenCount = 0;
  let inFunction = false;
  let functionType = '';
  let endIndex = codeLines.length;

  for (let i = 0; i < codeLines.length; i++) {
    const line = codeLines[i].trim();

    // Detect function type
    if (!inFunction) {
      if (line.includes('function ') || line.startsWith('export function')) {
        inFunction = true;
        functionType = 'regular';
      } else if (line.match(/(const|let)\s+\w+.*=>/)) {
        inFunction = true;
        functionType = 'arrow';
      } else if (line.match(/(const|let)\s+\w+.*=\s*function/)) {
        inFunction = true;
        functionType = 'expression';
      }
    }

    if (inFunction) {
      // Count braces and parentheses
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
      }

      // For arrow functions with single expression
      if (
        functionType === 'arrow' &&
        line.includes('=>') &&
        !line.includes('{')
      ) {
        // Single expression arrow function
        if (line.trim().endsWith(';')) {
          endIndex = i + 1;
          break;
        }
      }

      // For functions with blocks, end when braces are balanced
      if (braceCount === 0 && line.includes('}') && functionType !== 'arrow') {
        endIndex = i + 1;
        break;
      }

      // For arrow functions with blocks
      if (functionType === 'arrow' && braceCount === 0 && line.includes('}')) {
        // Check if this line also ends with semicolon or is standalone
        endIndex = i + 1;
        if (i + 1 < codeLines.length && codeLines[i + 1].trim() === ';') {
          endIndex = i + 2;
        }
        break;
      }
    }

    // Stop at obvious non-code lines
    if (
      inFunction &&
      line.startsWith('//') &&
      (line.toLowerCase().includes('usage') ||
        line.toLowerCase().includes('example') ||
        line.toLowerCase().includes('note:'))
    ) {
      break;
    }
  }

  // Extract the function code
  const functionCode = codeLines.slice(0, endIndex).join('\n').trim();

  return functionCode;
}

/**
 * Format generated code using Prettier
 */
async function formatGeneratedCode(code: string): Promise<string> {
  try {
    // Basic validation - check for severely malformed code
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    // If severely malformed, return as-is (Prettier will likely fail anyway)
    if (
      Math.abs(openBraces - closeBraces) > 2 ||
      Math.abs(openParens - closeParens) > 2
    ) {
      console.warn(
        'Generated code appears severely malformed, skipping Prettier formatting'
      );
      return code;
    }

    // Get Prettier configuration
    const config = (await prettier.resolveConfig(process.cwd())) || {};

    // Set TypeScript-specific options
    const options = {
      ...config,
      parser: 'typescript',
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5' as const,
      printWidth: 80,
    };

    // Format the code with Prettier
    const formatted = await prettier.format(code, options);
    return formatted.trim();
  } catch (error) {
    // If Prettier fails, return the original code
    console.warn(
      'Prettier formatting failed for generated code:',
      error instanceof Error ? error.message : String(error)
    );
    return code;
  }
}
