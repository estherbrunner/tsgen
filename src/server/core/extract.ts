/**
 * Extracts the contents of the first markdown codeblock with typescript, ts, javascript or js.
 *
 * @param {string} input - The markdown string to search for codeblocks.
 * @returns {string} The contents of the first matching codeblock, or the trimmed original input if no match.
 */
export function extractCodeBlock(input: string): string {
	return input
		.replace(/```(?:typescript|ts|javascript|js)?\s*\n?/g, '')
		.replace(/```\s*$/g, '')
		.trim()
}
