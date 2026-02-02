import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { NFTMetadata, CharacterType } from "./config";

const OUTPUT_PATH = join(import.meta.dir, "../../output/common");
const REPORT_PATH = join(OUTPUT_PATH, "rarity_report.csv");

const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

async function generateRarityReport() {
	console.log("=== Generating Rarity Report ===\n");

	// Collect all metadata files from character folders
	const allFiles: { path: string; file: string }[] = [];

	for (const char of characters) {
		const charMetadataPath = join(OUTPUT_PATH, char, "metadata");
		if (existsSync(charMetadataPath)) {
			const files = readdirSync(charMetadataPath).filter(f => f.endsWith(".json"));
			for (const file of files) {
				allFiles.push({ path: charMetadataPath, file });
			}
		}
	}

	const totalNFTs = allFiles.length;
	console.log(`Total NFTs: ${totalNFTs}\n`);

	// Count traits per layer
	const traitCounts: Record<string, Record<string, number>> = {};

	// Process all metadata
	for (const { path, file } of allFiles) {
		const metadata: NFTMetadata = await Bun.file(join(path, file)).json();

		// Count each trait
		for (const attr of metadata.attributes) {
			// Skip "Rarity" attribute
			if (attr.trait_type === "Rarity") continue;

			if (!traitCounts[attr.trait_type]) {
				traitCounts[attr.trait_type] = {};
			}
			traitCounts[attr.trait_type][attr.value] = (traitCounts[attr.trait_type][attr.value] || 0) + 1;
		}
	}

	// Define layer order
	const layerOrder = [
		"Character",
		"Background",
		"Base",
		"Shirt",
		"Necklace",
		"Mouth",
		"Eyes",
		"Eyeglasses",
		"Head Accessory",
		"Hand",
		"Hand Accessories",
		"Side Hand",
		"Side Hand Accessories",
	];

	// Generate CSV
	const csvLines: string[] = [];

	for (const layer of layerOrder) {
		if (!traitCounts[layer]) continue;

		const traits = traitCounts[layer];
		const traitEntries = Object.entries(traits).sort((a, b) => b[1] - a[1]);

		// Calculate total for this layer
		const layerTotal = traitEntries.reduce((sum, [_, count]) => sum + count, 0);
		const noneCount = totalNFTs - layerTotal;

		// Add layer header
		csvLines.push(layer);
		csvLines.push("Nama Traits,Qty,Weight (%)");

		// Add each trait
		for (const [value, count] of traitEntries) {
			const percentage = ((count / totalNFTs) * 100).toFixed(2);
			csvLines.push(`${value},${count},${percentage}`);
		}

		// Add "None" if applicable
		if (noneCount > 0) {
			const nonePercentage = ((noneCount / totalNFTs) * 100).toFixed(2);
			csvLines.push(`None,${noneCount},${nonePercentage}`);
		}

		// Add total row
		csvLines.push(`Total,${totalNFTs},100`);
		csvLines.push(""); // Empty line between sections
	}

	// Write CSV
	writeFileSync(REPORT_PATH, csvLines.join("\n"));
	console.log(`Rarity report saved to: ${REPORT_PATH}`);

	// Print summary
	console.log("\n=== Summary ===");
	for (const layer of layerOrder) {
		if (!traitCounts[layer]) continue;
		const variantCount = Object.keys(traitCounts[layer]).length;
		const withTrait = Object.values(traitCounts[layer]).reduce((a, b) => a + b, 0);
		const withoutTrait = totalNFTs - withTrait;
		console.log(`${layer}: ${variantCount} variants (${withTrait} have, ${withoutTrait} none)`);
	}
}

generateRarityReport().catch(console.error);
