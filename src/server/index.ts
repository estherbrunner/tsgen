import { type Server, file, serve } from 'bun'
import { codeToHtml } from 'shiki'
import { join } from 'path'

import { FunctionRequest, FunctionResponse } from '../shared/types'
import { generateFunctionWithRetries } from './core/generate'
import { llmFunction } from './io/llm'
import { formatAndLintFunction } from './io/format'
import { generateAndRunTests } from './io/test'

const PORT = process.env.PORT || 3000
const PUBLIC_DIR = join(process.cwd(), 'public')

async function startServer() {
	const server: Server = serve({
		port: PORT,
		async fetch(req) {
			const url = new URL(req.url)

			// Handle CORS preflight requests
			if (req.method === 'OPTIONS') {
				return new Response(null, {
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type',
					},
				})
			}

			// API endpoint to generate TypeScript functions
			if (url.pathname === '/api/generate' && req.method === 'POST') {
				try {
					const body = (await req.json()) as FunctionRequest

					// Generate TypeScript function from prompt (always use high-quality defaults)
					const generationResult = await generateFunctionWithRetries(
						body.prompt,
						{
							maxRetries: 3,
							llmFunction,
						}
					)

					// Format and lint the generated code
					const lintResult = await formatAndLintFunction(
						generationResult.finalCode
					)

					// Run tests on the formatted code
					const testResult = await generateAndRunTests(
						lintResult.formattedCode
					)

					// Apply syntax highlighting
					const highlightedCode = await codeToHtml(
						lintResult.formattedCode,
						{
							lang: 'typescript',
							theme: 'monokai',
						}
					)

					const response: FunctionResponse = {
						success: true,
						code: highlightedCode,
						typeCheckResult: generationResult.typeCheckResult,
						lintResult,
						testResult,
					}

					return new Response(JSON.stringify(response), {
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						},
					})
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : 'Unknown error'
					const isLLMError =
						errorMessage.includes('LMStudio') ||
						errorMessage.includes('Cannot connect') ||
						errorMessage.includes('No models available')

					return new Response(
						JSON.stringify({
							success: false,
							error: errorMessage,
						}),
						{
							status: isLLMError ? 503 : 400, // Service unavailable for LLM issues
							headers: {
								'Content-Type': 'application/json',
								'Access-Control-Allow-Origin': '*',
							},
						}
					)
				}
			}

			// Serve static files from the public directory
			if (url.pathname === '/' || url.pathname === '/index.html') {
				try {
					const indexFile = file(join(PUBLIC_DIR, 'index.html'))
					if (await indexFile.exists()) {
						return new Response(await indexFile.arrayBuffer(), {
							headers: {
								'Content-Type': 'text/html',
							},
						})
					}
				} catch (error) {
					console.error('Error serving index.html:', error)
				}
			}

			// Handle other static files from public directory
			if (url.pathname.startsWith('/')) {
				try {
					const filePath = join(PUBLIC_DIR, url.pathname)
					const staticFile = file(filePath)

					if (await staticFile.exists()) {
						let contentType = 'application/octet-stream'

						if (filePath.endsWith('.html'))
							contentType = 'text/html'
						else if (filePath.endsWith('.css'))
							contentType = 'text/css'
						else if (filePath.endsWith('.js'))
							contentType = 'text/javascript'
						else if (filePath.endsWith('.json'))
							contentType = 'application/json'
						else if (filePath.endsWith('.png'))
							contentType = 'image/png'
						else if (
							filePath.endsWith('.jpg') ||
							filePath.endsWith('.jpeg')
						)
							contentType = 'image/jpeg'
						else if (filePath.endsWith('.svg'))
							contentType = 'image/svg+xml'

						return new Response(await staticFile.arrayBuffer(), {
							headers: {
								'Content-Type': contentType,
							},
						})
					}
				} catch (error) {
					console.error('Error serving static file:', error)
				}
			}

			// For any other route, return 404
			return new Response('Not Found', { status: 404 })
		},
	})

	console.log(`Server running at http://localhost:${PORT}`)
	return server
}

// Only start the server if this file is run directly
if (import.meta.main) {
	startServer()
}

export { startServer }
export default startServer
