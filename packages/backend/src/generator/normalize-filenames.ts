import { readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const TRAITS_PATH = join(import.meta.dir, "../../assets/art/traits");

function normalizeFilename(filename: string): string {
	return filename
		.toLowerCase()
		.replace(/\s+/g, "_") // Replace spaces with underscores
		.replace(/_+/g, "_") // Replace multiple underscores with single
		.replace(/_\./g, ".") // Remove trailing underscore before extension
		.replace(/[^\w.-]/g, "") // Remove special characters except underscore, dot, hyphen
		.replace(/_-_/g, "_") // Clean up underscore-hyphen combinations
		.trim();
}

const folders = readdirSync(TRAITS_PATH);

console.log("=== Normalizing filenames ===\n");

let totalRenamed = 0;

for (const folder of folders) {
	const folderPath = join(TRAITS_PATH, folder);
	const files = readdirSync(folderPath);
	let renamedInFolder = 0;

	for (const file of files) {
		const normalized = normalizeFilename(file);
		if (file !== normalized) {
			const oldPath = join(folderPath, file);
			const newPath = join(folderPath, normalized);
			renameSync(oldPath, newPath);
			renamedInFolder++;
			totalRenamed++;
		}
	}

	if (renamedInFolder > 0) {
		console.log(`${folder}: ${renamedInFolder} files renamed`);
	}
}

console.log(`\n✅ Total files renamed: ${totalRenamed}`);
