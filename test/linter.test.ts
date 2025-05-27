import { test, expect, describe } from 'bun:test';
import { lint } from '../src/server/linter';

describe('Linter', () => {
  test('should lint valid TypeScript code successfully', async () => {
    const validCode = `function add(a: number, b: number): number {
  return a + b;
}`;

    const result = await lint(validCode);

    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
  });

  test('should handle ESLint errors gracefully', async () => {
    // Test with code that might cause ESLint to fail
    const problematicCode = 'invalid typescript syntax here!!!';

    const result = await lint(problematicCode);

    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
  });

  test('should properly handle complex TypeScript syntax without parsing errors', async () => {
    const complexTypeScriptCode = `interface User<T> {
  id: number;
  name: string;
  data: T;
  roles?: string[];
}

type UserWithRole = User<{ permissions: string[] }>;

function processUser<T>(user: User<T>): Promise<T> {
  return Promise.resolve(user.data);
}

const users: UserWithRole[] = [
  {
    id: 1,
    name: 'John',
    data: { permissions: ['read', 'write'] }
  }
];

enum Status {
  Active = 'active',
  Inactive = 'inactive'
}`;

    const result = await lint(complexTypeScriptCode);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.issues)).toBe(true);

    // Should only have unused variable warnings, no syntax errors
    const syntaxErrors = result.issues.filter(
      issue =>
        issue.message.includes('Parsing error') ||
        issue.message.includes('Unexpected token')
    );
    expect(syntaxErrors.length).toBe(0);

    // Should detect unused variables
    const unusedWarnings = result.issues.filter(
      issue => issue.rule === 'no-unused-vars'
    );
    expect(unusedWarnings.length).toBeGreaterThan(0);
  });
});
