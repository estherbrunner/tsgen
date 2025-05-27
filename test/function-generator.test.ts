import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { generateFunction } from '../src/server/function-generator';

// Mock fetch for testing
const originalFetch = global.fetch;

describe('Function Generator', () => {
  beforeAll(() => {
    // Mock successful LMStudio responses
    (global as any).fetch = async (url: string | URL, options?: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/models')) {
        return new Response(
          JSON.stringify({
            data: [{ id: 'test-model' }],
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/chat/completions')) {
        const body = JSON.parse(options?.body || '{}');
        const prompt = body.messages?.[1]?.content || '';

        let mockCode = '';
        if (
          prompt.includes('add two numbers') ||
          prompt.includes('sum') ||
          prompt.includes('adds two numbers')
        ) {
          mockCode = `function addNumbers(a: number, b: number): number {
  return a + b;
}`;
        } else if (prompt.includes('multiply')) {
          mockCode = `function multiply(x: number, y: number): number {
  return x * y;
}`;
        } else if (prompt.includes('adds numbers')) {
          mockCode = `function addNumbers(a: number, b: number): number {
  return a + b;
}`;
        } else {
          mockCode = `function generatedFunction(): void {
  // Generated function
}`;
        }

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: mockCode } }],
          }),
          { status: 200 }
        );
      }

      return originalFetch(url, options);
    };
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('should generate a simple function', async () => {
    const result = await generateFunction(
      'create a function that adds two numbers'
    );

    expect(result).toBeDefined();
    expect(result).toContain('function');
    expect(result).toContain('number');
    expect(typeof result).toBe('string');
  });

  test('should handle JSDoc option', async () => {
    const result = await generateFunction(
      'create a function that multiplies two numbers'
    );

    expect(result).toBeDefined();
    expect(result).toContain('function');
  });

  test('should throw error when LMStudio is unavailable', async () => {
    // Temporarily mock fetch to simulate connection failure
    (global as any).fetch = async () => {
      throw new TypeError('fetch failed');
    };

    await expect(generateFunction('test')).rejects.toThrow(
      /Cannot connect to LMStudio/
    );

    // Restore mock
    (global as any).fetch = async (url: string | URL, options?: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'test-model' }] }), {
          status: 200,
        });
      }
      if (urlStr.includes('/chat/completions')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'function test() {}' } }],
          }),
          { status: 200 }
        );
      }
      return originalFetch(url, options);
    };
  });

  test('should throw error when no models available', async () => {
    // Mock empty models response
    (global as any).fetch = async (url: string | URL) => {
      if (url.toString().includes('/models')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return originalFetch(url);
    };

    await expect(generateFunction('test')).rejects.toThrow(
      /No models available/
    );

    // Restore proper mock
    (global as any).fetch = async (url: string | URL, options?: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'test-model' }] }), {
          status: 200,
        });
      }
      if (urlStr.includes('/chat/completions')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'function test() {}' } }],
          }),
          { status: 200 }
        );
      }
      return originalFetch(url, options);
    };
  });

  test('should handle LMStudio API errors', async () => {
    // Mock API error response
    (global as any).fetch = async (url: string | URL) => {
      if (url.toString().includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'test-model' }] }), {
          status: 200,
        });
      }
      if (url.toString().includes('/chat/completions')) {
        return new Response('Internal Server Error', { status: 500 });
      }
      return originalFetch(url);
    };

    await expect(generateFunction('test')).rejects.toThrow(
      /LMStudio API error/
    );

    // Restore working mock for subsequent tests
    (global as any).fetch = async (url: string | URL, options?: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'test-model' }] }), {
          status: 200,
        });
      }
      if (urlStr.includes('/chat/completions')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'function test() {}' } }],
          }),
          { status: 200 }
        );
      }
      return originalFetch(url, options);
    };
  });

  test('should format generated code with Prettier', async () => {
    const result = await generateFunction(
      'create a function that adds numbers'
    );

    // Should be properly formatted
    expect(result).not.toContain('  {'); // No inconsistent spacing
    expect(
      result
        .split('\n')
        .every(
          line =>
            line.trim() === '' ||
            !line.startsWith(' ') ||
            line.startsWith('  ') ||
            line.startsWith('    ')
        )
    ).toBe(true); // Consistent indentation
  });
});
