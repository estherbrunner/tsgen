import { codeToHtml } from 'shiki'

export async function highlightCode(code: string) {
	const html = await codeToHtml(code, {
		lang: 'typescript',
		theme: 'monokai',
	})
	return html
}
