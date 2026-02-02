import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type NFTMetadata,
	type LayerType,
	type Rarity,
	LAYER_ORDER_LEGENDARY,
	LAYER_ORDER_COMMON,
} from "./config";
import type { SelectedTraits } from "./random";

const OUTPUT_PATH = join(import.meta.dir, "../../output");

const LAYER_DISPLAY_NAMES: Record<LayerType, string> = {
	background: "Background",
	base: "Base",
	shirt: "Shirt",
	clothes: "Clothes",
	side_hand: "Side Hand",
	side_hand_accessories: "Hand Accessories",
	necklaces: "Necklace",
	mouth: "Mouth",
	eyes: "Eyes",
	eyeglasses: "Eyeglasses",
	head_acc: "Head Accessory",
	hand: "Hand",
	hand_accessories: "Hand Accessories",
	accessories: "Hand Accessories",
};

const CHARACTER_DISPLAY_NAMES: Record<string, string> = {
	bear: "Bear",
	bunny: "Bunny",
	fox: "Fox",
	chogstar: "Chogstar",
};

export function generateMetadata(
	selection: SelectedTraits,
	tokenId: number,
	baseImageURI: string,
): NFTMetadata {
	const attributes: Array<{ trait_type: string; value: string }> = [];

	// Add rarity
	attributes.push({
		trait_type: "Rarity",
		value: selection.rarity.charAt(0).toUpperCase() + selection.rarity.slice(1),
	});

	// Add character type
	attributes.push({
		trait_type: "Character",
		value:
			CHARACTER_DISPLAY_NAMES[selection.character] || selection.character,
	});

	const layerOrder =
		selection.rarity === "legendary"
			? LAYER_ORDER_LEGENDARY
			: LAYER_ORDER_COMMON;

	// Add each trait
	const traits = [];
	for (const layer of layerOrder) {
		const trait = selection.traits.get(layer);
		if (trait) {
			attributes.push({
				trait_type: LAYER_DISPLAY_NAMES[layer] || layer,
				value: trait.name,
			});
			traits.push(trait);
		}
	}

	const characterName = CHARACTER_DISPLAY_NAMES[selection.character];
	const rarityName =
		selection.rarity.charAt(0).toUpperCase() + selection.rarity.slice(1);

	return {
		tokenId,
		name: `Collectible #${tokenId}`,
		description: `A ${rarityName} ${characterName} from the Collectible collection.`,
		image: `${baseImageURI}/${tokenId}.png`,
		attributes,
		character: selection.character,
		rarity: selection.rarity,
		traits,
	};
}

export async function saveMetadata(metadata: NFTMetadata): Promise<string> {
	const outputPath = join(OUTPUT_PATH, "metadata", `${metadata.tokenId}.json`);

	// Create clean metadata for storage (without internal fields)
	const cleanMetadata = {
		name: metadata.name,
		description: metadata.description,
		image: metadata.image,
		attributes: metadata.attributes,
	};

	await writeFile(outputPath, JSON.stringify(cleanMetadata, null, 2));
	return outputPath;
}

export async function saveCollectionMetadata(
	allMetadata: NFTMetadata[],
): Promise<void> {
	// Save full collection data for internal use
	const collectionPath = join(OUTPUT_PATH, "collection.json");
	await writeFile(collectionPath, JSON.stringify(allMetadata, null, 2));

	// Generate rarity report (JSON and CSV)
	const rarityReport = generateRarityReport(allMetadata);
	const reportPath = join(OUTPUT_PATH, "rarity_report.json");
	await writeFile(reportPath, JSON.stringify(rarityReport, null, 2));
	await saveRarityReportCSV(allMetadata);
}

interface RarityReport {
	totalSupply: number;
	rarityDistribution: Record<string, number>;
	characterDistribution: Record<string, number>;
	rarityByCharacter: Record<string, Record<string, number>>;
	traitDistribution: Record<string, Record<string, number>>;
}

function generateRarityReport(allMetadata: NFTMetadata[]): RarityReport {
	const report: RarityReport = {
		totalSupply: allMetadata.length,
		rarityDistribution: {},
		characterDistribution: {},
		rarityByCharacter: {},
		traitDistribution: {},
	};

	for (const metadata of allMetadata) {
		// Rarity distribution
		report.rarityDistribution[metadata.rarity] =
			(report.rarityDistribution[metadata.rarity] || 0) + 1;

		// Character distribution
		report.characterDistribution[metadata.character] =
			(report.characterDistribution[metadata.character] || 0) + 1;

		// Rarity by character
		if (!report.rarityByCharacter[metadata.character]) {
			report.rarityByCharacter[metadata.character] = {};
		}
		report.rarityByCharacter[metadata.character][metadata.rarity] =
			(report.rarityByCharacter[metadata.character][metadata.rarity] || 0) + 1;

		// Trait distribution
		for (const attr of metadata.attributes) {
			if (!report.traitDistribution[attr.trait_type]) {
				report.traitDistribution[attr.trait_type] = {};
			}
			report.traitDistribution[attr.trait_type][attr.value] =
				(report.traitDistribution[attr.trait_type][attr.value] || 0) + 1;
		}
	}

	return report;
}

export function generateContractMetadata(
	name: string,
	description: string,
	image: string,
	externalLink?: string,
): object {
	return {
		name,
		description,
		image,
		external_link: externalLink,
	};
}

export async function saveRarityReportCSV(
	allMetadata: NFTMetadata[],
): Promise<void> {
	const report = generateRarityReport(allMetadata);
	const lines: string[] = [];

	// Header
	lines.push("Category,Item,Count,Percentage");

	// Total Supply
	lines.push(`Total Supply,All,${report.totalSupply},100.00%`);
	lines.push("");

	// Rarity Distribution
	lines.push("# Rarity Distribution");
	for (const [rarity, count] of Object.entries(report.rarityDistribution)) {
		const pct = ((count / report.totalSupply) * 100).toFixed(2);
		lines.push(`Rarity,${rarity},${count},${pct}%`);
	}
	lines.push("");

	// Character Distribution
	lines.push("# Character Distribution");
	for (const [character, count] of Object.entries(report.characterDistribution)) {
		const pct = ((count / report.totalSupply) * 100).toFixed(2);
		lines.push(`Character,${character},${count},${pct}%`);
	}
	lines.push("");

	// Rarity by Character
	lines.push("# Rarity by Character");
	for (const [character, rarities] of Object.entries(report.rarityByCharacter)) {
		for (const [rarity, count] of Object.entries(rarities)) {
			const pct = ((count / report.totalSupply) * 100).toFixed(2);
			lines.push(`${character},${rarity},${count},${pct}%`);
		}
	}
	lines.push("");

	// Trait Distribution
	lines.push("# Trait Distribution");
	for (const [traitType, values] of Object.entries(report.traitDistribution)) {
		for (const [value, count] of Object.entries(values)) {
			const pct = ((count / report.totalSupply) * 100).toFixed(2);
			lines.push(`${traitType},${value},${count},${pct}%`);
		}
	}

	const csvPath = join(OUTPUT_PATH, "rarity_report.csv");
	await writeFile(csvPath, lines.join("\n"));
}
