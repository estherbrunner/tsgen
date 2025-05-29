import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

import type { FileNameAndContents, TempFiles } from '../../shared/types'

/**
 * Read the contents of a file.
 *
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string>} - The contents of the file.
 */
export async function readFile(filePath: string): Promise<string> {
	try {
		return await fs.readFile(filePath, 'utf8')
	} catch (readError: any) {
		throw new Error(`Failed to read file: ${readError.message}`)
	}
}

/**
 * Write content to a file
 *
 * @param filePath
 * @param contents
 */
export async function writeFile(
	filePath: string,
	contents: string
): Promise<void> {
	try {
		await fs.writeFile(filePath, contents, 'utf8')
	} catch (writeError: any) {
		throw new Error(`Failed to write file: ${writeError.message}`)
	}
}

/**
 * Create a temporary file with the given name.
 *
 * @param {FileNameAndContent[]} files
 * @returns {Promise<TempFiles>} - An object containing the cleanup function and the path to the temporary file.
 */
export async function createTempFiles(
	files: FileNameAndContents[]
): Promise<TempFiles> {
	let tempDir: string
	const tempFiles: string[] = []

	try {
		// Create temporary directory and file
		tempDir = await fs.mkdtemp(os.tmpdir())
		for (const file of files) {
			const tempFile = path.join(tempDir, file.name)
			tempFiles.push(tempFile)
			await fs.writeFile(tempFile, file.contents, 'utf8')
		}
	} catch (writeError: any) {
		throw new Error(`Failed to write temporary file: ${writeError.message}`)
	}

	return {
		paths: tempFiles,
		cleanup: async () => {
			// Clean up temporary files
			if (tempFiles.length) {
				try {
					for (const tempFile of tempFiles) {
						await fs.unlink(tempFile)
					}
				} catch {
					// Ignore cleanup errors
				}
			}
			if (tempDir) {
				try {
					await fs.rmdir(tempDir)
				} catch {
					// Ignore cleanup errors
				}
			}
		},
	}
}
