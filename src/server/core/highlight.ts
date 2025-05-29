import { codeToHtml } from 'shiki'

/**
 * Highlight syntax of code using Shiki
 *
 * @param {string} code - The code to be highlighted.
 * @returns {Promise<string>} Highlighted code as HTML string.
 */
export async function highlightCode(code: string): Promise<string> {
	const html = await codeToHtml(code, {
		lang: 'typescript',
		theme: 'monokai',
	})
	return html
}
