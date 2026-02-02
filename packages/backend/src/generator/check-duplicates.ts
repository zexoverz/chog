import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { NFTMetadata } from "./config";

const OUTPUT_PATH = join(import.meta.dir, "../../output/common/metadata");

async function checkDuplicates() {
	console.log("=== Checking for Duplicate NFTs ===\n");

	const files = readdirSync(OUTPUT_PATH).filter(f => f.endsWith(".json"));
	console.log(`Total NFTs to check: ${files.length}\n`);

	const dnaMap = new Map<string, number[]>();

	for (const file of files) {
		const tokenId = parseInt(file.replace(".json", ""));
		const metadata: NFTMetadata = await Bun.file(join(OUTPUT_PATH, file)).json();

		// Create DNA string from character + all traits
		const traitParts = metadata.attributes
			.map(attr => `${attr.trait_type}:${attr.value}`)
			.sort()
			.join("|");
		const dna = `${metadata.character}|${traitParts}`;

		if (dnaMap.has(dna)) {
			dnaMap.get(dna)!.push(tokenId);
		} else {
			dnaMap.set(dna, [tokenId]);
		}
	}

	// Find duplicates
	const duplicates: Array<{ dna: string; tokenIds: number[] }> = [];
	for (const [dna, tokenIds] of dnaMap) {
		if (tokenIds.length > 1) {
			duplicates.push({ dna, tokenIds });
		}
	}

	if (duplicates.length === 0) {
		console.log("✓ No duplicates found! All NFTs are unique.");
	} else {
		console.log(`✗ Found ${duplicates.length} duplicate groups:\n`);
		for (const { dna, tokenIds } of duplicates.slice(0, 10)) {
			console.log(`  Token IDs: ${tokenIds.join(", ")}`);
			console.log(`  DNA: ${dna.substring(0, 100)}...`);
			console.log();
		}
		if (duplicates.length > 10) {
			console.log(`  ... and ${duplicates.length - 10} more duplicate groups`);
		}
	}

	console.log(`\n=== Summary ===`);
	console.log(`Total NFTs: ${files.length}`);
	console.log(`Unique combinations: ${dnaMap.size}`);
	console.log(`Duplicate groups: ${duplicates.length}`);
}

checkDuplicates().catch(console.error);
