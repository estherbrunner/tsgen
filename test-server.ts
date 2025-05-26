// Test script to verify server functionality
import { generateFunction } from './src/server/function-generator';
import { typeCheck } from './src/server/type-checker';
import { formatAndLint } from './src/server/linter';
import { runTests } from './src/server/test-runner';

async function testComponents() {
  console.log('Testing TypeScript Function Generator components...\n');

  // Test function generation
  console.log('1. Testing function generation...');
  try {
    const code = await generateFunction('sum all numbers in an array', {
      includeJSDoc: true,
      strictTypes: true
    });
    console.log('✅ Function generation successful');
    console.log('Generated code:');
    console.log(code);
    console.log();

    // Test type checking
    console.log('2. Testing type checker...');
    const typeCheckResult = await typeCheck(code);
    console.log(`✅ Type check: ${typeCheckResult.success ? 'PASSED' : 'FAILED'}`);
    if (typeCheckResult.message) {
      console.log('Message:', typeCheckResult.message);
    }
    console.log();

    // Test formatting and linting
    console.log('3. Testing formatting and linting...');
    const { formattedCode, lintResult } = await formatAndLint(code);
    console.log(`✅ Format & Lint check: ${lintResult.success ? 'PASSED' : 'FAILED'}`);
    console.log(`Issues found: ${lintResult.issues.length}`);
    lintResult.issues.forEach(issue => {
      console.log(`  - ${issue.severity}: ${issue.message} (line ${issue.line})`);
    });
    console.log('Formatted code:');
    console.log(formattedCode);
    console.log();

    // Test runner
    console.log('4. Testing test runner...');
    const testResult = await runTests(formattedCode, [
      'input [1, 2, 3] should return 6',
      'input [] should return 0'
    ]);
    console.log(`✅ Tests: ${testResult.success ? 'PASSED' : 'FAILED'}`);
    testResult.tests.forEach(test => {
      console.log(`  - ${test.name}: ${test.passed ? 'PASS' : 'FAIL'} - ${test.message}`);
    });

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Test API endpoint
async function testAPI() {
  console.log('\n5. Testing API endpoint...');
  try {
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'create a function that multiplies two numbers',
        options: {
          includeJSDoc: true
        },
        testCases: ['input 2, 3 should return 6']
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API endpoint working');
      console.log('API Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ API endpoint failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ API endpoint error:', error instanceof Error ? error.message : error);
    console.log('Make sure the server is running with: bun run dev');
  }
}

// Run tests
if (import.meta.main) {
  await testComponents();
  await testAPI();
}
