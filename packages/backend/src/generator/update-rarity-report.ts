import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NFTMetadata } from "./config";

const OUTPUT_PATH = join(import.meta.dir, "../../output");

// Load collection
const collection: NFTMetadata[] = JSON.parse(
	readFileSync(join(OUTPUT_PATH, "collection.json"), "utf-8"),
);

// Generate rarity report
interface RarityReport {
	totalSupply: number;
	rarityDistribution: Record<string, number>;
	characterDistribution: Record<string, number>;
	rarityByCharacter: Record<string, Record<string, number>>;
	traitDistribution: Record<string, Record<string, number>>;
}

const report: RarityReport = {
	totalSupply: collection.length,
	rarityDistribution: {},
	characterDistribution: {},
	rarityByCharacter: {},
	traitDistribution: {},
};

for (const nft of collection) {
	// Rarity distribution
	report.rarityDistribution[nft.rarity] =
		(report.rarityDistribution[nft.rarity] || 0) + 1;

	// Character distribution
	report.characterDistribution[nft.character] =
		(report.characterDistribution[nft.character] || 0) + 1;

	// Rarity by character
	if (!report.rarityByCharacter[nft.character]) {
		report.rarityByCharacter[nft.character] = {};
	}
	report.rarityByCharacter[nft.character][nft.rarity] =
		(report.rarityByCharacter[nft.character][nft.rarity] || 0) + 1;

	// Trait distribution
	for (const attr of nft.attributes) {
		if (!report.traitDistribution[attr.trait_type]) {
			report.traitDistribution[attr.trait_type] = {};
		}
		report.traitDistribution[attr.trait_type][attr.value] =
			(report.traitDistribution[attr.trait_type][attr.value] || 0) + 1;
	}
}

// Save JSON
writeFileSync(
	join(OUTPUT_PATH, "rarity_report.json"),
	JSON.stringify(report, null, 2),
);

// Generate CSV
const lines: string[] = [];
const totalNFTs = report.totalSupply;

for (const [traitType, values] of Object.entries(report.traitDistribution)) {
	if (traitType === "Rarity" || traitType === "Character") continue;

	lines.push(traitType);
	lines.push("Nama Traits,Qty,Weight (%)");

	const traitTotal = Object.values(values).reduce((a, b) => a + b, 0);
	const noneCount = totalNFTs - traitTotal;

	for (const [name, count] of Object.entries(values)) {
		const weight = ((count / totalNFTs) * 100).toFixed(0);
		lines.push(`${name},${count},${weight}`);
	}

	// Add "None" row for optional traits
	if (noneCount > 0) {
		const noneWeight = ((noneCount / totalNFTs) * 100).toFixed(0);
		lines.push(`None,${noneCount},${noneWeight}`);
	}

	lines.push(`Total,${totalNFTs},100`);
	lines.push("");
}

writeFileSync(join(OUTPUT_PATH, "rarity_report.csv"), lines.join("\n"));

console.log("Rarity report updated (JSON + CSV)");
