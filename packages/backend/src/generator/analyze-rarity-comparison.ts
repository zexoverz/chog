import { readdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_PATH = join(import.meta.dir, "../../output/common");

// Known legendary trait names with their layers (from asset folders)
const LEGENDARY_TRAITS: { name: string; layer: string }[] = [
	// Backgrounds
	{ name: "Background Wormhole", layer: "Background" },
	{ name: "Background Milkyway", layer: "Background" },
	{ name: "Background Halo", layer: "Background" },
	{ name: "Background Goldy", layer: "Background" },
	{ name: "Backgroundn Sunset", layer: "Background" },
	{ name: "Backgrounds Flame", layer: "Background" },
	{ name: "Background Lensflare", layer: "Background" },
	{ name: "Backgrounds Starshine", layer: "Background" },
	{ name: "Purple", layer: "Background" }, // Purple background is legendary
	// Clothes/Shirt
	{ name: "Outfit Cutegoldenstar", layer: "Shirt" },
	{ name: "Outfit Shark", layer: "Shirt" },
	{ name: "Outfit Cutestar", layer: "Shirt" },
	{ name: "Outfit Greenfrog", layer: "Shirt" },
	{ name: "Outfit Line", layer: "Shirt" },
	{ name: "Outfit Goldensweater", layer: "Shirt" },
	{ name: "Outfit Dino", layer: "Shirt" },
	// Eyes
	{ name: "Eyes Golden", layer: "Eyes" },
	{ name: "Laser Red Eyes", layer: "Eyes" },
	{ name: "Laser Yellow Eyes", layer: "Eyes" },
	{ name: "Eyes Fiery Glow", layer: "Eyes" },
	{ name: "Eyes Aura3", layer: "Eyes" },
	{ name: "Laser Blue Eyes", layer: "Eyes" },
	{ name: "Eyes Heterochromia", layer: "Eyes" },
	{ name: "Eyes Aura", layer: "Eyes" },
	{ name: "Eyes Aura2", layer: "Eyes" },
	{ name: "Eyes Fiery", layer: "Eyes" },
	// Side Hand Accessories
	{ name: "Golden Ak47", layer: "Hand Accessories" },
	{ name: "Golden Katana", layer: "Hand Accessories" },
];

const characters = ["bear", "bunny", "fox", "chogstar"] as const;

interface TraitInfo {
	trait: string;
	layer: string;
	count: number;
	percentage: number;
	isLegendary: boolean;
}

async function analyzeRarityComparison() {
	console.log("=== Rarity Comparison Analysis ===\n");

	// Collect all metadata
	const allTraits: Record<string, Record<string, number>> = {};
	let totalNFTs = 0;

	for (const char of characters) {
		const metadataPath = join(OUTPUT_PATH, char, "metadata");
		const files = readdirSync(metadataPath).filter((f) => f.endsWith(".json"));
		totalNFTs += files.length;

		for (const file of files) {
			const metadata = await Bun.file(join(metadataPath, file)).json();
			for (const attr of metadata.attributes) {
				if (attr.trait_type === "Rarity") continue;
				if (!allTraits[attr.trait_type]) allTraits[attr.trait_type] = {};
				allTraits[attr.trait_type][attr.value] =
					(allTraits[attr.trait_type][attr.value] || 0) + 1;
			}
		}
	}

	console.log(`Total NFTs: ${totalNFTs}\n`);

	// Collect all traits with their info
	const traitList: TraitInfo[] = [];

	for (const [layer, traits] of Object.entries(allTraits)) {
		for (const [trait, count] of Object.entries(traits)) {
			const isLegendary = LEGENDARY_TRAITS.some(
				(leg) =>
					leg.name.toLowerCase() === trait.toLowerCase() && leg.layer === layer,
			);
			traitList.push({
				trait,
				layer,
				count,
				percentage: (count / totalNFTs) * 100,
				isLegendary,
			});
		}
	}

	// Sort by count ascending (rarest first)
	traitList.sort((a, b) => a.count - b.count);

	// Analysis 1: Legendary trait stats
	console.log("=== LEGENDARY TRAITS (Inherited to Commons) ===");
	const legendaryTraits = traitList.filter((t) => t.isLegendary);
	let totalLegendaryCount = 0;
	for (const t of legendaryTraits.sort((a, b) => a.count - b.count)) {
		console.log(
			`  ${t.trait} (${t.layer}): ${t.count} (${t.percentage.toFixed(2)}%)`,
		);
		totalLegendaryCount += t.count;
	}
	console.log(`\nTotal legendary trait occurrences: ${totalLegendaryCount}`);
	console.log(`Legendary traits found: ${legendaryTraits.length} types\n`);

	// Analysis 2: Common traits rarer than most common legendary
	const maxLegendaryCount = Math.max(...legendaryTraits.map((t) => t.count));
	const minLegendaryCount = Math.min(...legendaryTraits.map((t) => t.count));

	console.log(
		`Legendary range: ${minLegendaryCount} - ${maxLegendaryCount} occurrences\n`,
	);

	// Find common traits that are rarer than or equal to the most common legendary
	const rarerCommonTraits = traitList.filter(
		(t) => !t.isLegendary && t.count <= maxLegendaryCount,
	);

	console.log("=== COMMON TRAITS RARER THAN LEGENDARY ===");
	console.log(
		`(Traits appearing <= ${maxLegendaryCount} times, same or less than most common legendary)\n`,
	);

	for (const t of rarerCommonTraits.slice(0, 30)) {
		console.log(
			`  ${t.trait} (${t.layer}): ${t.count} (${t.percentage.toFixed(2)}%)`,
		);
	}

	if (rarerCommonTraits.length > 30) {
		console.log(
			`  ... and ${rarerCommonTraits.length - 30} more common traits`,
		);
	}

	console.log(
		`\nTotal common traits rarer than legendary: ${rarerCommonTraits.length}`,
	);

	// Summary comparison
	console.log("\n=== SUMMARY ===");
	console.log(
		`Legendary traits: ${legendaryTraits.length} types, appearing ${minLegendaryCount}-${maxLegendaryCount} times each`,
	);
	console.log(
		`Common traits rarer than max legendary (${maxLegendaryCount}): ${rarerCommonTraits.length} types`,
	);

	// Show the problem
	console.log("\n=== RARITY INVERSION ISSUE ===");
	console.log(
		"These COMMON traits are actually RARER than some LEGENDARY traits:\n",
	);

	const avgLegendary = totalLegendaryCount / legendaryTraits.length;
	const veryRareCommon = traitList.filter(
		(t) => !t.isLegendary && t.count < avgLegendary,
	);

	for (const t of veryRareCommon.slice(0, 20)) {
		console.log(
			`  ${t.trait} (${t.layer}): ${t.count} - RARER than avg legendary (${avgLegendary.toFixed(1)})`,
		);
	}
}

analyzeRarityComparison().catch(console.error);
