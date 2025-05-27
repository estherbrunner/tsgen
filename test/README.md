# Test Suite

This directory contains comprehensive tests for all server-side functionality of the TypeScript Function Generator.

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test test/function-generator.test.ts
bun test test/linter.test.ts
bun test test/type-checker.test.ts
bun test test/test-runner.test.ts

# Run tests in watch mode
bun test --watch
```

## Test Files

### `function-generator.test.ts`
Tests the core function generation functionality:
- LLM integration with LMStudio
- Error handling for unavailable services
- Code cleaning and formatting

### `linter.test.ts`
Tests the linting and formatting functionality:
- ESLint integration

### `type-checker.test.ts`
Tests TypeScript type checking:
- Valid/invalid code detection
- Type error reporting
- Complex TypeScript features (generics, interfaces, etc.)
- Syntax error handling

### `test-runner.test.ts`
Tests the test execution functionality:
- Test case generation and parsing
- Function execution with various input types
- Error handling and reporting
- Test result parsing

## Test Structure

Each test file follows the same pattern:
- Uses Bun's Jest-compatible test API
- Includes setup/teardown for mocking when needed
- Tests both success and failure scenarios
- Validates return types and structures
- Includes edge cases and error conditions

## Mocking

The function generator tests use fetch mocking to simulate LMStudio API responses without requiring an actual LMStudio instance to be running during tests.

## Coverage

Tests cover:
- ✅ Happy path scenarios
- ✅ Error conditions
- ✅ Edge cases
- ✅ Type validation
- ✅ Integration points
- ✅ Resource cleanup
