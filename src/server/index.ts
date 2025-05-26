import { serve } from 'bun';
import type { Server } from 'bun';
import { generateFunction } from './function-generator';
import { typeCheck } from './type-checker';
import { runTests } from './test-runner';
import { lint } from './linter';
import { FunctionRequest, FunctionResponse } from '../shared/types';
import { join } from 'path';
import { file } from 'bun';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(process.cwd(), 'public');

async function startServer() {
  const server: Server = serve({
    port: PORT,
    async fetch(req) {
    const url = new URL(req.url);
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // API endpoint to generate TypeScript functions
    if (url.pathname === '/api/generate' && req.method === 'POST') {
      try {
        const body = await req.json() as FunctionRequest;
        
        // Generate TypeScript function from prompt
        const generatedCode = await generateFunction(body.prompt, body.options);
        
        // Type check the generated code
        const typeCheckResults = await typeCheck(generatedCode);
        
        // Lint the generated code
        const lintResults = await lint(generatedCode);
        
        // Run tests on the generated code
        const testResults = await runTests(generatedCode, body.testCases || []);
        
        const response: FunctionResponse = {
          success: true,
          code: generatedCode,
          typeCheckResults,
          lintResults,
          testResults,
        };
        
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }
    
    // Serve static files from the public directory
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        const indexFile = file(join(PUBLIC_DIR, 'index.html'));
        if (await indexFile.exists()) {
          return new Response(await indexFile.arrayBuffer(), {
            headers: {
              'Content-Type': 'text/html',
            },
          });
        }
      } catch (error) {
        console.error('Error serving index.html:', error);
      }
      
      // Fallback HTML if index.html doesn't exist
      const fallbackHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript Function Generator</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        button { background: #007acc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        textarea { width: 100%; min-height: 100px; margin: 10px 0; }
        .result { margin-top: 20px; padding: 10px; background: white; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>TypeScript Function Generator</h1>
        <p>Generate TypeScript functions from natural language descriptions</p>
        <textarea id="prompt" placeholder="Describe the function you need..."></textarea>
        <button onclick="generateFunction()">Generate Function</button>
        <div id="result" class="result" style="display:none;"></div>
    </div>
    <script>
        async function generateFunction() {
            const prompt = document.getElementById('prompt').value;
            if (!prompt) return;
            
            const result = document.getElementById('result');
            result.style.display = 'block';
            result.innerHTML = 'Generating...';
            
            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });
                const data = await response.json();
                
                if (data.success) {
                    result.innerHTML = '<h3>Generated Function:</h3><pre>' + data.code + '</pre>';
                } else {
                    result.innerHTML = '<h3>Error:</h3><p>' + data.error + '</p>';
                }
            } catch (error) {
                result.innerHTML = '<h3>Error:</h3><p>' + error.message + '</p>';
            }
        }
    </script>
</body>
</html>`;
      
      return new Response(fallbackHTML, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }
    

    // Handle other static files from public directory
    if (url.pathname.startsWith('/')) {
      try {
        const filePath = join(PUBLIC_DIR, url.pathname);
        const staticFile = file(filePath);
        
        if (await staticFile.exists()) {
          let contentType = 'application/octet-stream';
          
          if (filePath.endsWith('.html')) contentType = 'text/html';
          else if (filePath.endsWith('.css')) contentType = 'text/css';
          else if (filePath.endsWith('.js')) contentType = 'text/javascript';
          else if (filePath.endsWith('.json')) contentType = 'application/json';
          else if (filePath.endsWith('.png')) contentType = 'image/png';
          else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
          else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
          
          return new Response(await staticFile.arrayBuffer(), {
            headers: {
              'Content-Type': contentType,
            },
          });
        }
      } catch (error) {
        console.error('Error serving static file:', error);
      }
    }
    
    // For any other route, return 404
    return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`Server running at http://localhost:${PORT}`);
  return server;
}

// Only start the server if this file is run directly
if (import.meta.main) {
  startServer();
}

export { startServer };
export default startServer;