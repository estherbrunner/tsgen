/**
 * Type checker for TypeScript code
 * Validates the generated code for type errors
 */

import { TypeCheckResult } from '../../shared/types';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';

/**
 * Type check TypeScript code
 *
 * @param code - The TypeScript code to check
 * @returns Result of type checking
 */
export async function typeCheck(code: string): Promise<TypeCheckResult> {
  // Create a temporary file to hold the code
  const tempFileName = `temp-${randomUUID()}.ts`;
  const tempFilePath = join(process.cwd(), tempFileName);

  try {
    // Write the code to the temporary file
    writeFileSync(tempFilePath, code);

    // Run TypeScript compiler to check for type errors
    const tscResult = spawnSync(
      'npx',
      ['tsc', '--noEmit', '--strict', tempFilePath],
      {
        encoding: 'utf-8',
      }
    );

    // Check if type checking was successful
    if (tscResult.status === 0) {
      return {
        success: true,
      };
    } else {
      // Parse error messages
      const errorLines = tscResult.stderr ? tscResult.stderr.split('\n') : [];
      const errorMessage =
        errorLines.length > 0
          ? errorLines.filter(line => line.trim() !== '').join('\n')
          : 'Type checking failed with unknown errors';

      // Extract warnings (for this simple implementation, we're just checking for specific keywords)
      const warnings = errorLines
        .filter(line => line.includes('warning TS'))
        .map(line => line.trim());

      return {
        success: false,
        message: errorMessage,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown error during type checking',
    };
  } finally {
    // Clean up the temporary file
    try {
      unlinkSync(tempFilePath);
    } catch (e) {
      // Ignore errors when deleting the temporary file
    }
  }
}

/**
 * Extract type information from TypeScript code
 * This function could be expanded to provide more detailed type information
 *
 * @param code - The TypeScript code to analyze
 * @returns Information about the types used in the code
 */
export function extractTypeInfo(code: string): {
  paramTypes: string[];
  returnType: string;
} {
  // Extract parameter types (very basic implementation)
  const paramTypesMatch = code.match(/function\s+\w+\s*\((.*?)\)\s*:/);
  const paramTypes = paramTypesMatch
    ? paramTypesMatch[1].split(',').map(param => {
        const typeMatch = param.match(/:\s*(\w+)/);
        return typeMatch ? typeMatch[1] : 'unknown';
      })
    : [];

  // Extract return type (very basic implementation)
  const returnTypeMatch = code.match(/\)\s*:\s*(\w+)/);
  const returnType = returnTypeMatch ? returnTypeMatch[1] : 'unknown';

  return {
    paramTypes,
    returnType,
  };
}
