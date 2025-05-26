/**
 * Function generator for TypeScript code
 * Handles the actual code generation from natural language prompts using LMStudio LLM API
 */

import { FunctionRequest } from '../shared/types';

// LMStudio API configuration
const LMSTUDIO_BASE_URL = 'http://localhost:1234/v1';
const DEFAULT_MODEL = 'gpt-3.5-turbo'; // Will be updated with actual available model

/**
 * Get available models from LMStudio
 */
async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${LMSTUDIO_BASE_URL}/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    const data = await response.json();
    return data.data?.map((model: any) => model.id) || [];
  } catch (error) {
    console.error('Error fetching models from LMStudio:', error);
    return [];
  }
}

/**
 * Generate a TypeScript function from a natural language prompt using LMStudio LLM
 * 
 * @param prompt - Natural language description of the function to create
 * @param options - Optional configuration for the function generation
 * @returns The generated TypeScript code as a string
 */
export async function generateFunction(
  prompt: string,
  options: FunctionRequest['options'] = {}
): Promise<string> {
  try {
    // Get available models to use the first one available
    const models = await getAvailableModels();
    const modelToUse = models.length > 0 ? models[0] : DEFAULT_MODEL;
    
    // Build the system prompt based on options
    const systemPrompt = buildSystemPrompt(options);
    
    // Build the user prompt
    const userPrompt = buildUserPrompt(prompt, options);
    
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`LMStudio API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const generatedCode = data.choices?.[0]?.message?.content;
    
    if (!generatedCode) {
      throw new Error('No code generated from LLM response');
    }
    
    // Clean up the generated code
    return cleanGeneratedCode(generatedCode);
    
  } catch (error) {
    console.error('Error generating function with LLM:', error);
    
    // Fallback to simple pattern-based generation
    console.log('Falling back to pattern-based generation...');
    return generateFallbackCode(prompt, options);
  }
}

/**
 * Build system prompt based on options
 */
function buildSystemPrompt(options: FunctionRequest['options'] = {}): string {
  const targetVersion = options.targetVersion || 'latest';
  const functionalStyle = options.functionalStyle ? 'functional programming' : 'imperative';
  const strictTypes = options.strictTypes ? 'strict TypeScript types' : 'flexible types';
  
  return `You are an expert TypeScript developer. Generate clean, well-structured TypeScript functions based on user requirements.

Requirements:
- Target version: ${targetVersion}
- Programming style: ${functionalStyle}
- Type strictness: ${strictTypes}
- Include JSDoc comments: ${options.includeJSDoc ? 'yes' : 'no'}
- Complexity level: ${options.complexityLevel || 3}/5

Guidelines:
1. Write only the function, no additional explanation
2. Use proper TypeScript syntax and types
3. Follow best practices for readability and performance
4. Include proper error handling when appropriate
5. Use descriptive parameter and variable names
6. Return only the function code, no markdown formatting`;
}

/**
 * Build user prompt for the LLM
 */
function buildUserPrompt(prompt: string, options: FunctionRequest['options'] = {}): string {
  let userPrompt = `Create a TypeScript function that: ${prompt}`;
  
  if (options.includeJSDoc) {
    userPrompt += '\n\nInclude comprehensive JSDoc comments with parameter descriptions and return type.';
  }
  
  if (options.functionalStyle) {
    userPrompt += '\n\nUse functional programming patterns where possible (pure functions, immutability, higher-order functions).';
  }
  
  if (options.strictTypes) {
    userPrompt += '\n\nUse strict TypeScript types with no "any" types unless absolutely necessary.';
  }
  
  return userPrompt;
}

/**
 * Clean up generated code by removing markdown formatting and extra text
 */
function cleanGeneratedCode(code: string): string {
  // Remove markdown code blocks
  code = code.replace(/```(?:typescript|ts|javascript|js)?\s*\n?/g, '').replace(/```\s*$/g, '');
  
  // Split into lines for processing
  const lines = code.split('\n');
  
  // Find the start of actual code (JSDoc or function)
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('/**') || 
        line.startsWith('function ') || 
        line.match(/^(export\s+)?(const|let)\s+\w+/) ||
        line.startsWith('export function')) {
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
  
  // Find the end of the function
  let braceCount = 0;
  let inFunction = false;
  let endIndex = codeLines.length;
  
  for (let i = 0; i < codeLines.length; i++) {
    const line = codeLines[i];
    
    if (line.includes('function ') || line.match(/(const|let)\s+\w+.*=>/)) {
      inFunction = true;
    }
    
    if (inFunction) {
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      // For arrow functions, check for semicolon ending
      if (line.includes('=>') && line.trim().endsWith(';')) {
        endIndex = i + 1;
        break;
      }
      
      // For regular functions, check for closing brace
      if (braceCount === 0 && line.includes('}')) {
        endIndex = i + 1;
        break;
      }
    }
  }
  
  // Extract the function code
  const functionCode = codeLines.slice(0, endIndex).join('\n').trim();
  
  // Final cleanup - remove any trailing explanatory text
  const cleanedLines = functionCode.split('\n');
  const finalLines = [];
  
  for (const line of cleanedLines) {
    finalLines.push(line);
    // Stop if we hit the end of a function and there's explanatory text after
    if (line.trim() === '}' && finalLines.length > 1) {
      break;
    }
  }
  
  return finalLines.join('\n').trim();
}

/**
 * Fallback function generation when LLM is not available
 */
function generateFallbackCode(prompt: string, options: FunctionRequest['options'] = {}): string {
  const functionName = extractFunctionName(prompt);
  
  // Include JSDoc if specified
  const jsDoc = options.includeJSDoc
    ? `/**
 * ${prompt}
 * 
 * @param data - Input data to process
 * @returns The processed result
 */
`
    : '';
  
  // Create a simple implementation based on the prompt
  if (prompt.includes('sum') || prompt.includes('add')) {
    return `${jsDoc}function ${functionName}(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0);
}`;
  } else if (prompt.includes('filter') || prompt.includes('even')) {
    return `${jsDoc}function ${functionName}(numbers: number[]): number[] {
  return numbers.filter(num => num % 2 === 0);
}`;
  } else if (prompt.includes('sort')) {
    return `${jsDoc}function ${functionName}(items: any[]): any[] {
  return [...items].sort();
}`;
  } else if (prompt.includes('multiply') || prompt.includes('product')) {
    return `${jsDoc}function ${functionName}(a: number, b: number): number {
  return a * b;
}`;
  } else if (prompt.includes('factorial')) {
    return `${jsDoc}function ${functionName}(n: number): number {
  if (n <= 1) return 1;
  return n * ${functionName}(n - 1);
}`;
  } else {
    // Generic placeholder function
    return `${jsDoc}function ${functionName}(data: any): any {
  // TODO: Implement function based on: ${prompt}
  return data;
}`;
  }
}

/**
 * Extract a function name from the prompt
 */
function extractFunctionName(prompt: string): string {
  // Remove common prefixes
  let cleanedPrompt = prompt
    .replace(/^(write|create|implement|make|build)\s*a?\s*function\s*(to|that)\s*/i, '')
    .replace(/^(write|create|implement|make|build)\s*a?\s*function\s*/i, '');
  
  // Extract the main verb/action
  const verbMatch = cleanedPrompt.match(/^([a-z]+)/i);
  if (verbMatch) {
    const verb = verbMatch[1].toLowerCase();
    
    // Handle special cases
    if (verb === 'calculate' || verb === 'compute') {
      const subjectMatch = cleanedPrompt.match(/calculate\s+(?:the\s+)?(\w+)/i);
      return subjectMatch ? subjectMatch[1].toLowerCase() : 'calculate';
    }
    
    return verb;
  }
  
  // Look for specific keywords
  if (cleanedPrompt.includes('factorial')) return 'factorial';
  if (cleanedPrompt.includes('fibonacci')) return 'fibonacci';
  if (cleanedPrompt.includes('palindrome')) return 'isPalindrome';
  if (cleanedPrompt.includes('prime')) return 'isPrime';
  
  // Fallback
  return 'processData';
}