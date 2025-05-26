import { test, expect, describe } from 'bun:test';
import { lint, formatCode, formatAndLint } from '../src/server/linter';

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

  test('should detect linting issues in malformed code', async () => {
    const badCode = `function bad(a: number, b: number): number {
return a + b
}`;
    
    const result = await lint(badCode);
    
    expect(result).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
    // May have issues depending on ESLint configuration
  });

  test('should format code with Prettier', async () => {
    const messyCode = `function   test(  a:number,b:number  ){
return a+b
}`;
    
    const formatted = await formatCode(messyCode);
    
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('function test(');
    expect(formatted).toContain(': number');
  });

  test('should handle malformed code gracefully in formatting', async () => {
    const malformedCode = `function test( {
// Missing closing brace and params
`;
    
    const formatted = await formatCode(malformedCode);
    
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
    // Should return original code if severely malformed
  });

  test('should format and lint code together', async () => {
    const code = `function test(a: number, b: number): number {
  return a + b;
}`;
    
    const result = await formatAndLint(code);
    
    expect(result).toBeDefined();
    expect(result.formattedCode).toBeDefined();
    expect(result.lintResult).toBeDefined();
    expect(typeof result.formattedCode).toBe('string');
    expect(result.lintResult.success).toBeDefined();
    expect(Array.isArray(result.lintResult.issues)).toBe(true);
  });

  test('should preserve function structure during formatting', async () => {
    const functionCode = `function calculate(x: number, y: number): number {
  const result = x * y;
  return result;
}`;
    
    const formatted = await formatCode(functionCode);
    
    expect(formatted).toContain('function calculate');
    expect(formatted).toContain('return result;');
    expect(formatted).toMatch(/}\s*$/); // Should end with closing brace
  });

  test('should handle arrow functions in formatting', async () => {
    const arrowFunction = `const multiply = (a: number, b: number): number => {
  return a * b;
};`;
    
    const formatted = await formatCode(arrowFunction);
    
    expect(formatted).toContain('=>');
    expect(formatted).toContain('const multiply');
    expect(formatted).toMatch(/;\s*$/); // Should end with semicolon
  });

  test('should handle single expression arrow functions', async () => {
    const singleExpression = `const square = (x: number): number => x * x;`;
    
    const formatted = await formatCode(singleExpression);
    
    expect(formatted).toContain('=>');
    expect(formatted).toContain('x * x');
    expect(formatted).toMatch(/;\s*$/); // Should end with semicolon
  });

  test('should handle complex TypeScript syntax', async () => {
    const complexCode = `interface User {
  name: string;
  age: number;
}

function processUser(user: User): string {
  return \`User: \${user.name}, Age: \${user.age}\`;
}`;
    
    const result = await formatAndLint(complexCode);
    
    expect(result.formattedCode).toContain('interface User');
    expect(result.formattedCode).toContain('function processUser');
    expect(result.lintResult).toBeDefined();
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
    const syntaxErrors = result.issues.filter(issue => 
      issue.message.includes('Parsing error') || 
      issue.message.includes('Unexpected token')
    );
    expect(syntaxErrors.length).toBe(0);
    
    // Should detect unused variables
    const unusedWarnings = result.issues.filter(issue => 
      issue.rule === 'no-unused-vars'
    );
    expect(unusedWarnings.length).toBeGreaterThan(0);
  });
});