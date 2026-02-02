import {
	type CharacterType,
	type LayerType,
	type LayerTypeLegendary,
	type LayerTypeCommon,
	type Rarity,
	type TraitMetadata,
	OPTIONAL_LAYERS_LEGENDARY,
	OPTIONAL_LAYERS_COMMON,
	OPTIONAL_TRAIT_CHANCE_LEGENDARY,
	OPTIONAL_TRAIT_CHANCE_COMMON,
	LAYER_ORDER_LEGENDARY,
	LAYER_ORDER_COMMON,
	COLOR_MATCHING_COMMON,
	LEGENDARY_BASE_HAND_PAIRING,
	LEGENDARY_INHERITABLE_TRAITS,
	LEGENDARY_LASER_EYES,
	LEGENDARY_CLOTHES_BLOCKS_HEAD_ACC,
	COMMON_HOODIES,
	COMMON_ASTRONAUT,
	HEAD_ACC_BLOCKS_EYEGLASSES,
} from "./config";
import { type TraitDatabase, getTraitsForCharacter } from "./traits";

// Seeded random number generator for reproducibility
export class SeededRandom {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	// Mulberry32 PRNG
	next(): number {
		let t = (this.seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	nextInt(min: number, max: number): number {
		return Math.floor(this.next() * (max - min + 1)) + min;
	}

	shuffle<T>(array: T[]): T[] {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(this.next() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	}
}

function selectRandomTrait(
	traits: TraitMetadata[],
	rng: SeededRandom,
): TraitMetadata {
	const index = rng.nextInt(0, traits.length - 1);
	return traits[index];
}

export interface SelectedTraits {
	character: CharacterType;
	rarity: Rarity;
	traits: Map<LayerType, TraitMetadata | null>;
	hasLegendaryInheritance?: boolean; // For common NFTs that inherit legendary traits
}

export function selectTraitsForNFT(
	db: TraitDatabase,
	character: CharacterType,
	rarity: Rarity,
	rng: SeededRandom,
	forcedBase?: string, // Optional: force a specific base filename
	legendaryInherit?: boolean, // For common NFTs: inherit legendary traits
): SelectedTraits {
	const selected = new Map<LayerType, TraitMetadata | null>();

	const layerOrder =
		rarity === "legendary" ? LAYER_ORDER_LEGENDARY : LAYER_ORDER_COMMON;
	const optionalLayers =
		rarity === "legendary" ? OPTIONAL_LAYERS_LEGENDARY : OPTIONAL_LAYERS_COMMON;
	const optionalChance =
		rarity === "legendary"
			? OPTIONAL_TRAIT_CHANCE_LEGENDARY
			: OPTIONAL_TRAIT_CHANCE_COMMON;

	// Track inherited legendary traits for rule enforcement
	let hasLegendaryEyes = false;
	let hasLegendaryClothes = false;
	let inheritedLegendaryLayers: Set<string> = new Set();

	// Track common shirt rules
	let hasCommonHoodie = false; // Blocks head_acc
	let hasAstronaut = false; // Blocks head_acc AND legendary eyes

	// For common NFTs with legendary inheritance, decide which traits to inherit
	if (rarity === "common" && legendaryInherit) {
		// Randomly select which legendary traits to inherit
		for (const inheritableLayer of LEGENDARY_INHERITABLE_TRAITS) {
			// 50% chance to inherit each eligible layer
			if (rng.next() < 0.5) {
				inheritedLegendaryLayers.add(inheritableLayer);
			}
		}
		// Ensure at least one legendary trait is inherited
		if (inheritedLegendaryLayers.size === 0) {
			const randomIndex = rng.nextInt(0, LEGENDARY_INHERITABLE_TRAITS.length - 1);
			inheritedLegendaryLayers.add(LEGENDARY_INHERITABLE_TRAITS[randomIndex]);
		}
	}

	// Track base filename for hand matching
	let selectedBaseFilename: string | null = null;

	// Only 1 accessory per NFT: "right" (hand+acc), "left" (side_hand+acc), or "no_hand" (accessories only)
	const accessoryRoll = rng.next();
	const accessoryType = accessoryRoll < 0.33 ? "right" : accessoryRoll < 0.66 ? "left" : "no_hand";

	// Check if accessory is present (optional)
	const accChance = (optionalChance as Record<string, number>)[
		accessoryType === "right" ? "hand_accessories" :
		accessoryType === "left" ? "side_hand_accessories" : "accessories"
	] ?? 50;
	const hasAccessory = rng.next() * 100 <= accChance;

	for (const layer of layerOrder) {
		// For common NFTs inheriting legendary traits
		// Map "shirt" to "clothes" for inheritance check
		const inheritCheckLayer = layer === "shirt" ? "clothes" : layer;
		const shouldInheritLegendary = rarity === "common" && legendaryInherit && inheritedLegendaryLayers.has(inheritCheckLayer);

		// Get traits from appropriate source
		let traits: TraitMetadata[];
		if (shouldInheritLegendary && layer === "shirt") {
			// Get legendary clothes for shirt layer
			traits = getTraitsForCharacter(db, character, "clothes" as LayerType, "legendary");
		} else if (shouldInheritLegendary && LEGENDARY_INHERITABLE_TRAITS.includes(layer as any)) {
			// Get legendary traits for this layer
			traits = getTraitsForCharacter(db, character, layer, "legendary");
		} else {
			traits = getTraitsForCharacter(db, character, layer, rarity);
		}

		if (traits.length === 0) {
			selected.set(layer, null);
			continue;
		}

		// Skip eyeglasses if legendary eyes or astronaut are being used
		if (layer === "eyeglasses" && (hasLegendaryEyes || hasAstronaut)) {
			selected.set(layer, null);
			continue;
		}

		// Skip head_acc if legendary clothes, common hoodie, or astronaut are being used
		if (layer === "head_acc" && (hasLegendaryClothes || hasCommonHoodie || hasAstronaut)) {
			selected.set(layer, null);
			continue;
		}

		// Skip necklaces if legendary clothes, common hoodie, or astronaut are being used
		if (layer === "necklaces" && (hasLegendaryClothes || hasCommonHoodie || hasAstronaut)) {
			selected.set(layer, null);
			continue;
		}

		// For astronaut, prevent legendary eyes from being inherited
		if (layer === "eyes" && hasAstronaut && shouldInheritLegendary) {
			// Use common eyes instead of legendary eyes
			traits = getTraitsForCharacter(db, character, layer, "common");
		}

		// Handle hand + accessories: only 1 accessory type per NFT
		// Hand only exists if its accessory exists
		const handAccLayers = ["hand", "hand_accessories", "side_hand", "side_hand_accessories", "accessories"];
		if (handAccLayers.includes(layer)) {
			// No accessory = no hand either
			if (!hasAccessory) {
				selected.set(layer, null);
				continue;
			}

			if (accessoryType === "right") {
				// Right hand + hand_accessories only
				if (["side_hand", "side_hand_accessories", "accessories"].includes(layer)) {
					selected.set(layer, null);
					continue;
				}
			} else if (accessoryType === "left") {
				// Side hand + side_hand_accessories only
				if (["hand", "hand_accessories", "accessories"].includes(layer)) {
					selected.set(layer, null);
					continue;
				}
			} else {
				// No hand, only accessories
				if (["hand", "hand_accessories", "side_hand", "side_hand_accessories"].includes(layer)) {
					selected.set(layer, null);
					continue;
				}
			}
		} else {
			// Check if this is an optional layer (only for non-hand layers)
			if (optionalLayers.includes(layer as never)) {
				const chance = (optionalChance as Record<string, number>)[layer] ?? 50;
				if (rng.next() * 100 > chance) {
					selected.set(layer, null);
					continue;
				}
			}
		}

		// For legendary: match hand/side_hand to base style
		if (rarity === "legendary" && selectedBaseFilename) {
			const handPairing = LEGENDARY_BASE_HAND_PAIRING[selectedBaseFilename];

			if (layer === "hand" && handPairing?.hand) {
				const matchingTrait = traits.find((t) => t.filename === handPairing.hand);
				if (matchingTrait) {
					selected.set(layer, matchingTrait);
					continue;
				}
			}

			if (layer === "side_hand" && handPairing?.side_hand) {
				const matchingTrait = traits.find((t) => t.filename === handPairing.side_hand);
				if (matchingTrait) {
					selected.set(layer, matchingTrait);
					continue;
				}
			}
		}

		// For common rarity, match hand/side_hand to base color
		if (rarity === "common" && selectedBaseFilename) {
			const colorMatch = COLOR_MATCHING_COMMON[character]?.[selectedBaseFilename];

			if (layer === "hand" && colorMatch?.hand) {
				const matchingTrait = traits.find((t) => t.filename === colorMatch.hand);
				if (matchingTrait) {
					selected.set(layer, matchingTrait);
					continue;
				}
			}

			if (layer === "side_hand" && colorMatch?.side_hand) {
				const matchingTrait = traits.find((t) => t.filename === colorMatch.side_hand);
				if (matchingTrait) {
					selected.set(layer, matchingTrait);
					continue;
				}
			}
		}

		// Select a trait (forced or random)
		let trait: TraitMetadata;
		if (layer === "base" && forcedBase) {
			// Use forced base if specified
			const forcedTrait = traits.find((t) => t.filename === forcedBase);
			trait = forcedTrait || selectRandomTrait(traits, rng);
		} else {
			trait = selectRandomTrait(traits, rng);
		}
		selected.set(layer, trait);

		// Track base filename for hand matching
		if (layer === "base") {
			selectedBaseFilename = trait.filename;
		}

		// Track if legendary eyes or clothes were selected (for rule enforcement on later layers)
		// Check if legendary eyes were selected - block eyeglasses (any legendary eyes)
		if (layer === "eyes" && trait.rarity === "legendary") {
			hasLegendaryEyes = true;
		}
		// Check if legendary clothes were selected - block head_acc
		if (layer === "shirt" && trait.rarity === "legendary" && LEGENDARY_CLOTHES_BLOCKS_HEAD_ACC) {
			hasLegendaryClothes = true;
		}

		// Track common shirt rules (hoodies and astronaut)
		if (layer === "shirt" && trait.rarity === "common") {
			if (COMMON_HOODIES.includes(trait.filename)) {
				hasCommonHoodie = true;
			}
			if (COMMON_ASTRONAUT.includes(trait.filename)) {
				hasAstronaut = true;
			}
		}

		// If head_acc is a mask/scarf that blocks eyeglasses and legendary eyes
		if (layer === "head_acc" && HEAD_ACC_BLOCKS_EYEGLASSES.includes(trait.filename)) {
			selected.set("eyeglasses", null);

			// Also replace legendary eyes with common eyes
			const currentEyes = selected.get("eyes");
			if (currentEyes && currentEyes.rarity === "legendary") {
				const commonEyes = getTraitsForCharacter(db, character, "eyes", "common");
				if (commonEyes.length > 0) {
					const randomCommonEyes = commonEyes[rng.nextInt(0, commonEyes.length - 1)];
					selected.set("eyes", randomCommonEyes);
				}
			}
		}
	}

	return { character, rarity, traits: selected, hasLegendaryInheritance: legendaryInherit };
}

export function generateDNAHash(selection: SelectedTraits): string {
	const layerOrder =
		selection.rarity === "legendary"
			? LAYER_ORDER_LEGENDARY
			: LAYER_ORDER_COMMON;

	const parts: string[] = [selection.character, selection.rarity];

	for (const layer of layerOrder) {
		const trait = selection.traits.get(layer);
		parts.push(trait ? trait.filename : "none");
	}

	return parts.join("|");
}

export function selectUniqueNFTs(
	db: TraitDatabase,
	count: number,
	character: CharacterType,
	rarity: Rarity,
	baseSeed: number,
): SelectedTraits[] {
	const results: SelectedTraits[] = [];
	const seenDNA = new Set<string>();
	let attempts = 0;
	const maxAttempts = count * 20;

	while (results.length < count && attempts < maxAttempts) {
		const rng = new SeededRandom(baseSeed + attempts);
		const selection = selectTraitsForNFT(db, character, rarity, rng);
		const dna = generateDNAHash(selection);

		if (!seenDNA.has(dna)) {
			seenDNA.add(dna);
			results.push(selection);
		}

		attempts++;
	}

	if (results.length < count) {
		console.warn(
			`Warning: Could only generate ${results.length}/${count} unique ${rarity} NFTs for ${character}`,
		);
	}

	return results;
}
