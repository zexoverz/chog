import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import {
	type CharacterType,
	type LayerType,
	type LayerTypeLegendary,
	type LayerTypeCommon,
	type Rarity,
	type TraitMetadata,
	CHARACTER_TRAITS_LEGENDARY,
	CHARACTER_TRAITS_COMMON,
	SHARED_TRAITS_LEGENDARY,
	SHARED_TRAITS_COMMON,
	LEGENDARY_BASE_FILES,
	LAYER_ORDER_LEGENDARY,
	LAYER_ORDER_COMMON,
} from "./config";

const ASSETS_PATH_COMMON = join(import.meta.dir, "../../assets/art/traits");
const ASSETS_PATH_LEGENDARY = join(import.meta.dir, "../../assets/art/legendary");

export interface TraitDatabase {
	legendary: {
		shared: Map<LayerTypeLegendary, TraitMetadata[]>;
		characters: Map<CharacterType, Map<LayerTypeLegendary, TraitMetadata[]>>;
	};
	common: {
		shared: Map<LayerTypeCommon, TraitMetadata[]>;
		characters: Map<CharacterType, Map<LayerTypeCommon, TraitMetadata[]>>;
	};
}

function getTraitName(filename: string): string {
	const name = filename.replace(/\.png$/i, "");
	return name
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

async function loadTraitsFromFolder(
	folderPath: string,
	layer: LayerType,
	rarity: Rarity,
	filterFiles?: string[],
): Promise<TraitMetadata[]> {
	try {
		const files = await readdir(folderPath);
		let pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png"));

		// Filter to specific files if provided
		if (filterFiles) {
			pngFiles = pngFiles.filter((f) => filterFiles.includes(f));
		}

		return pngFiles.map((filename) => ({
			layer,
			name: getTraitName(filename),
			filename,
			rarity,
		}));
	} catch {
		console.warn(`Warning: Could not load traits from ${folderPath}`);
		return [];
	}
}

export async function loadTraitDatabase(): Promise<TraitDatabase> {
	const db: TraitDatabase = {
		legendary: {
			shared: new Map(),
			characters: new Map(),
		},
		common: {
			shared: new Map(),
			characters: new Map(),
		},
	};

	// Load legendary shared traits
	for (const [layer, folder] of Object.entries(SHARED_TRAITS_LEGENDARY)) {
		const traits = await loadTraitsFromFolder(
			join(ASSETS_PATH_LEGENDARY, folder),
			layer as LayerTypeLegendary,
			"legendary",
		);
		db.legendary.shared.set(layer as LayerTypeLegendary, traits);
	}

	// Load legendary character-specific traits (base only, filtered by character)
	const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

	for (const character of characters) {
		const charTraits = new Map<LayerTypeLegendary, TraitMetadata[]>();

		// Load base with character-specific filter
		const baseFolder = CHARACTER_TRAITS_LEGENDARY[character].base;
		if (baseFolder) {
			const baseFiles = LEGENDARY_BASE_FILES[character];
			const traits = await loadTraitsFromFolder(
				join(ASSETS_PATH_LEGENDARY, baseFolder),
				"base",
				"legendary",
				baseFiles,
			);
			charTraits.set("base", traits);
		}

		db.legendary.characters.set(character, charTraits);
	}

	// Load common shared traits
	for (const [layer, folder] of Object.entries(SHARED_TRAITS_COMMON)) {
		const traits = await loadTraitsFromFolder(
			join(ASSETS_PATH_COMMON, folder),
			layer as LayerTypeCommon,
			"common",
		);
		db.common.shared.set(layer as LayerTypeCommon, traits);
	}

	// Load common character-specific traits
	for (const character of characters) {
		const charTraits = new Map<LayerTypeCommon, TraitMetadata[]>();
		const charConfig = CHARACTER_TRAITS_COMMON[character];

		for (const [layer, folder] of Object.entries(charConfig)) {
			const traits = await loadTraitsFromFolder(
				join(ASSETS_PATH_COMMON, folder),
				layer as LayerTypeCommon,
				"common",
			);
			charTraits.set(layer as LayerTypeCommon, traits);
		}

		db.common.characters.set(character, charTraits);
	}

	return db;
}

export function getTraitsForCharacter(
	db: TraitDatabase,
	character: CharacterType,
	layer: LayerType,
	rarity: Rarity,
): TraitMetadata[] {
	if (rarity === "legendary") {
		const charTraits = db.legendary.characters.get(character);
		if (charTraits?.has(layer as LayerTypeLegendary)) {
			return charTraits.get(layer as LayerTypeLegendary) || [];
		}
		return db.legendary.shared.get(layer as LayerTypeLegendary) || [];
	} else {
		const charTraits = db.common.characters.get(character);
		if (charTraits?.has(layer as LayerTypeCommon)) {
			return charTraits.get(layer as LayerTypeCommon) || [];
		}
		return db.common.shared.get(layer as LayerTypeCommon) || [];
	}
}

export function getTraitPath(
	character: CharacterType,
	layer: LayerType,
	filename: string,
	rarity: Rarity,
): string {
	if (rarity === "legendary") {
		// Map common layer names to legendary equivalents for inherited traits
		let legendaryLayer: LayerTypeLegendary = layer as LayerTypeLegendary;
		if (layer === "shirt") legendaryLayer = "clothes";

		const charConfig = CHARACTER_TRAITS_LEGENDARY[character];
		if (legendaryLayer in charConfig) {
			const folder = charConfig[legendaryLayer as keyof typeof charConfig];
			return join(ASSETS_PATH_LEGENDARY, folder!, filename);
		}
		const sharedFolder = SHARED_TRAITS_LEGENDARY[legendaryLayer];
		if (sharedFolder) {
			return join(ASSETS_PATH_LEGENDARY, sharedFolder, filename);
		}
	} else {
		const charConfig = CHARACTER_TRAITS_COMMON[character];
		if (layer in charConfig) {
			const folder = charConfig[layer as keyof typeof charConfig];
			return join(ASSETS_PATH_COMMON, folder!, filename);
		}
		const sharedFolder = SHARED_TRAITS_COMMON[layer as LayerTypeCommon];
		if (sharedFolder) {
			return join(ASSETS_PATH_COMMON, sharedFolder, filename);
		}
	}

	throw new Error(`Unknown layer: ${layer} for rarity: ${rarity}`);
}

export function printTraitSummary(db: TraitDatabase): void {
	console.log("\n=== Trait Database Summary ===\n");

	console.log("LEGENDARY Traits:");
	console.log("  Shared:");
	for (const [layer, traits] of db.legendary.shared) {
		console.log(`    ${layer}: ${traits.length} traits`);
	}
	console.log("  Per Character:");
	for (const [char, layers] of db.legendary.characters) {
		const baseCount = layers.get("base")?.length || 0;
		console.log(`    ${char}: ${baseCount} base variants`);
	}

	console.log("\nCOMMON Traits:");
	console.log("  Shared:");
	for (const [layer, traits] of db.common.shared) {
		console.log(`    ${layer}: ${traits.length} traits`);
	}
	console.log("  Per Character:");
	for (const [char, layers] of db.common.characters) {
		const counts = Array.from(layers.entries())
			.map(([l, t]) => `${l}:${t.length}`)
			.join(", ");
		console.log(`    ${char}: ${counts}`);
	}
}
