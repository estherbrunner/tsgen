# TypeScript Function Generator

A multi-agent coding assistant that writes TypeScript functions from a prompt, type-checks, lints, and tests them on the server and displays generated code on the client.

## Features

- Generate TypeScript functions from natural language descriptions
- Type-check generated code using TypeScript compiler
- Lint generated code to ensure best practices
- Test generated code automatically
- Display results on a client interface
- RESTful API for integration with other tools

## Installation

To install dependencies:

```bash
bun install
```

## Development

To run the development server:

```bash
bun run dev
```

For development with automatic rebuilding of client assets:

```bash
bun run dev:watch
```

The server will start on `http://localhost:3000`. You can access the web interface by visiting this URL in your browser.

## Usage

### Web Interface

1. Start the server with `bun run dev`
2. Open `http://localhost:3000` in your browser
3. Enter a description of the function you need (e.g., "sum all numbers in an array")
4. Configure options if needed (JSDoc comments, strict types, etc.)
5. Add test cases (optional)
6. Click "Generate Function" to see the results

### API Endpoint

Send a POST request to `/api/generate` with the following payload:

```json
{
  "prompt": "create a function that calculates factorial",
  "options": {
    "includeJSDoc": true,
    "strictTypes": true,
    "functionalStyle": false,
    "targetVersion": "latest",
    "complexityLevel": 3
  },
  "testCases": [
    "input 5 should return 120",
    "input 0 should return 1"
  ]
}
```

Response format:

```json
{
  "success": true,
  "code": "function factorial(n: number): number { ... }",
  "typeCheckResults": {
    "success": true
  },
  "lintResults": {
    "success": true,
    "issues": []
  },
  "testResults": {
    "success": true,
    "tests": [...]
  }
}
```

## Testing

To test all components:

```bash
bun test-server.ts
```

## Building

To build the complete project (server + client):

```bash
bun run build
```

To build only client assets (CSS + JavaScript):

```bash
bun run build:client
```

Individual asset building:

```bash
# Build and minify CSS
bun run css:build

# Build and minify JavaScript
bun run js:build
```

## Project Structure

```
tsgen/
├── src/
│   ├── server/           # Backend server and API
│   │   ├── index.ts      # Main server entry point
│   │   ├── function-generator.ts  # Code generation logic
│   │   ├── type-checker.ts       # TypeScript validation
│   │   ├── linter.ts             # Code linting
│   │   └── test-runner.ts        # Test execution
│   ├── client/           # Frontend client source code
│   │   ├── index.ts      # Client-side TypeScript
│   │   └── index.css     # Client-side CSS
│   └── shared/           # Shared types and interfaces
│       └── types.ts      # TypeScript interfaces
├── public/               # Static files served by the web server
│   ├── index.html        # Main web interface
│   ├── css/              # Built and minified CSS (generated)
│   └── js/               # Built and minified JavaScript (generated)
└── test-server.ts        # Test script
```

## Current Implementation Status

This is a working prototype with modern build tooling:

- ✅ **Function Generation**: LLM-powered code generation using LMStudio (with fallback to pattern-based generation)
- ✅ **Type Checking**: Uses TypeScript compiler for validation
- ✅ **Linting**: Basic rule-based linting (ESLint integration available)
- ✅ **Testing**: Simple test case parsing and execution
- ✅ **Web Interface**: Modern HTML interface with external CSS
- ✅ **API**: RESTful endpoint for all operations
- ✅ **Build System**: Automated TypeScript and CSS bundling with minification

## LLM Integration

This project now integrates with **LMStudio** for advanced code generation:

- **LMStudio API**: Connects to local LLM server at `http://localhost:1234`
- **Automatic Model Detection**: Uses the first available model from `/v1/models`
- **Intelligent Prompting**: Context-aware system prompts based on user options
- **Fallback System**: Falls back to pattern-based generation if LLM is unavailable

### Setting up LMStudio

1. Install and start LMStudio
2. Load your preferred model (code generation models like CodeLlama work well)
3. Start the local server (usually on port 1234)
4. The function generator will automatically detect and use the available model

## Build Tools

This project uses modern build tools for optimal performance:

- **Bun**: TypeScript compilation and JavaScript bundling
- **Lightning CSS**: CSS bundling, minification, and autoprefixing
- **Concurrently**: Running multiple build processes simultaneously

The build process creates optimized, minified assets in the `public/` directory that are served by the web server.

## Next Steps

To enhance this system for production use:

1. **Improve test case parsing** with better natural language understanding
3. **Add code formatting** with Prettier integration
4. **Enhance error handling** and validation
5. **Add authentication** and rate limiting for API access
6. **Implement caching** for generated functions
7. **Add more sophisticated linting rules**

## License

MIT © 2025 Zeix AG
