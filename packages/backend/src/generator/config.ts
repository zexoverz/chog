export type CharacterType = "bear" | "bunny" | "fox" | "chogstar";

export type Rarity = "legendary" | "common";

export const COLLECTION_CONFIG = {
	totalSupply: 5975, // 240 legendary + 5735 common
	distribution: {
		legendary: {
			percentage: 4,
			count: 240,
			perCharacter: 60, // 1% each
		},
		common: {
			percentage: 96,
			count: 5735,
			perCharacter: 1434, // ~24% each (5735 / 4 = 1433.75, round up for first 3)
			legendaryInheritPercentage: 1, // 1% of common NFTs inherit legendary traits
			legendaryInheritCount: 57, // ~1% of 5735
		},
	},
	characters: ["bear", "bunny", "fox", "chogstar"] as CharacterType[],
};

// Legendary traits that can be inherited by common NFTs
// Excluded: base, hand, side_hand (must use common versions matched to base color)
// Excluded: hand_accessories (golden items don't work with common hands)
export const LEGENDARY_INHERITABLE_TRAITS = [
	"background",
	"clothes", // If used, no head_acc allowed
	"eyes", // If used, no eyeglasses allowed
	"side_hand_accessories",
] as const;

// Legendary eyes that are considered "laser eyes" (no eyeglasses when used)
export const LEGENDARY_LASER_EYES = [
	"laser_blue_eyes.png",
	"laser_red_eyes.png",
	"laser_yellow_eyes.png",
	"eyes_fiery.png",
	"eyes_fiery_glow.png",
	"eyes_aura.png",
	"eyes_aura2.png",
	"eyes_aura3.png",
	"eyes_golden.png",
	"eyes_heterochromia.png",
];

// All legendary clothes block head_acc (they are full costumes/hoodies)
export const LEGENDARY_CLOTHES_BLOCKS_HEAD_ACC = true;

// Common shirts that are hoodies (block head_acc)
export const COMMON_HOODIES = [
	// bear/bunny/fox
	"beige_hoodie.png",
	"black_hoodie.png",
	"chogstar_hoodie.png",
	"purple_hoodie.png",
	"stripes_hoodie.png",
	"white_hoodie.png",
	// chogstar specific
	"gray__orange_striped_hoodie.png",
	"gray_hoodie.png",
];

// Common shirts that are astronaut suits (block head_acc AND legendary eyes)
export const COMMON_ASTRONAUT = [
	"astronaut.png",
];

// Head accessories that block eyeglasses (masks and scarves covering face)
export const HEAD_ACC_BLOCKS_EYEGLASSES = [
	// bear/bunny/fox
	"scarf.png",
	// chogstar masks
	"black_mask_w_black_hair.png",
	"black_mask_with_hair.png",
	"black_mask.png",
	"blue_mask.png",
	"fur_mask.png",
	"gojo_mask.png",
	"pink_scarf.png",
	"red_mask.png",
	"washed_mask.png",
	"yapper_mask.png",
];

// Layer order for compositing (bottom to top)
export const LAYER_ORDER_LEGENDARY = [
	"background",
	"base",
	"clothes",
	"eyes",
	"hand",
	"hand_accessories",
	"side_hand_accessories",
	"side_hand",
] as const;

export const LAYER_ORDER_COMMON = [
	"background",
	"base",
	"shirt",
	"necklaces",
	"mouth",
	"eyes",
	"eyeglasses",
	"head_acc",
	"hand",
	"hand_accessories",
	"side_hand_accessories",
	"side_hand",
] as const;

export type LayerTypeLegendary = (typeof LAYER_ORDER_LEGENDARY)[number];
export type LayerTypeCommon = (typeof LAYER_ORDER_COMMON)[number];
export type LayerType = LayerTypeLegendary | LayerTypeCommon;

// Optional layers (can be "none")
export const OPTIONAL_LAYERS_LEGENDARY: LayerTypeLegendary[] = [
	"clothes",
	"hand",
	"side_hand",
	"hand_accessories",
	"side_hand_accessories",
];

export const OPTIONAL_LAYERS_COMMON: LayerTypeCommon[] = [
	"shirt",
	"necklaces",
	"head_acc",
	"eyeglasses",
	"hand_accessories",
	"side_hand_accessories",
];

// Chance of having an optional trait (0-100)
export const OPTIONAL_TRAIT_CHANCE_LEGENDARY: Partial<
	Record<LayerTypeLegendary, number>
> = {
	clothes: 80,
	hand: 90,
	side_hand: 90,
	hand_accessories: 70,
	side_hand_accessories: 70,
};

export const OPTIONAL_TRAIT_CHANCE_COMMON: Partial<
	Record<LayerTypeCommon, number>
> = {
	shirt: 85,
	necklaces: 40,
	head_acc: 60,
	eyeglasses: 30,
	hand_accessories: 50,
	side_hand_accessories: 40,
};

// Base to hand pairing for legendary
// illuminate bases use golden/flame hands, translucent bases use lunar/spirit hands
export const LEGENDARY_BASE_HAND_PAIRING: Record<string, { hand: string; side_hand: string }> = {
	// Illuminate style
	"illuminate_bear.png": { hand: "golden_hands.png", side_hand: "hand_flame.png" },
	"illuminate_bunny.png": { hand: "golden_hands.png", side_hand: "hand_flame.png" },
	"illuminate_fox.png": { hand: "golden_hands.png", side_hand: "hand_flame.png" },
	"illuminate_chogstars.png": { hand: "golden_hands.png", side_hand: "hand_flame.png" },
	// Translucent style
	"bear_translucent.png": { hand: "lunar_hand.png", side_hand: "hand_spirit.png" },
	"bunny_translucent.png": { hand: "lunar_hand.png", side_hand: "hand_spirit.png" },
	"fox_translucent.png": { hand: "lunar_hand.png", side_hand: "hand_spirit.png" },
	"chogstars_translucent.png": { hand: "lunar_hand.png", side_hand: "hand_spirit.png" },
};

// Legendary character-specific trait folders
export const CHARACTER_TRAITS_LEGENDARY: Record<
	CharacterType,
	Partial<Record<LayerTypeLegendary, string>>
> = {
	bear: {
		base: "base_spirit",
	},
	bunny: {
		base: "base_spirit",
	},
	fox: {
		base: "base_spirit",
	},
	chogstar: {
		base: "base_spirit",
	},
};

// Legendary shared trait folders
export const SHARED_TRAITS_LEGENDARY: Partial<
	Record<LayerTypeLegendary, string>
> = {
	background: "background",
	clothes: "clothes",
	eyes: "eyes",
	hand: "hand_spirit",
	side_hand: "side_hand",
	hand_accessories: "hand_accessories_gold",
	side_hand_accessories: "side_hand_accessories_gold",
	// Note: legendary accessories (golden_axe, golden_sword, golden_lunarstaff) are in hand_accessories_gold
};

// Character base file patterns for legendary
export const LEGENDARY_BASE_FILES: Record<CharacterType, string[]> = {
	bear: ["bear_translucent.png", "illuminate_bear.png"],
	bunny: ["bunny_translucent.png", "illuminate_bunny.png"],
	fox: ["fox_translucent.png", "illuminate_fox.png"],
	chogstar: ["chogstars_translucent.png", "illuminate_chogstars.png"],
};

// Common character-specific trait folders
export const CHARACTER_TRAITS_COMMON: Record<
	CharacterType,
	Partial<Record<LayerTypeCommon, string>>
> = {
	bear: {
		base: "base_bear",
		hand: "hand_bear",
		side_hand: "side_hand_bear",
		shirt: "shirt_bear_bunny_fox",
		head_acc: "head_acc_bear_bunny_fox",
	},
	bunny: {
		base: "base_bunny",
		hand: "hand_bunny",
		side_hand: "side_hand_bunny",
		shirt: "shirt_bear_bunny_fox",
		head_acc: "head_acc_bear_bunny_fox",
	},
	fox: {
		base: "base_fox",
		hand: "hand_fox",
		side_hand: "side_hand_fox",
		shirt: "shirt_bear_bunny_fox",
		head_acc: "head_acc_bear_bunny_fox",
	},
	chogstar: {
		base: "base_chogstar",
		hand: "hand_chogstar",
		side_hand: "side_hand_chogstar",
		shirt: "shirt_chogstar",
		head_acc: "head_acc_chogstar",
	},
};

// Common shared trait folders
export const SHARED_TRAITS_COMMON: Partial<Record<LayerTypeCommon, string>> = {
	background: "background",
	eyes: "eyes",
	eyeglasses: "eyeglasses",
	mouth: "mouth",
	hand_accessories: "hand_accessories",
	side_hand_accessories: "side_hand_accessories",
	necklaces: "necklaces",
};

// Color matching: base -> [hand, side_hand] filenames
export const COLOR_MATCHING_COMMON: Record<
	CharacterType,
	Record<string, { hand: string; side_hand: string }>
> = {
	bear: {
		"brown.png": { hand: "chocolate_brown.png", side_hand: "chocolate_brown.png" },
		"gray.png": { hand: "medium_grey.png", side_hand: "medium_grey.png" },
		"grey_and_black.png": { hand: "light_mint_grey.png", side_hand: "light_mint_grey.png" },
		"mustard.png": { hand: "mustard_yellow.png", side_hand: "mustard_yellow.png" },
		"purple.png": { hand: "pale_lavender.png", side_hand: "pale_lavender.png" },
		"white_and_dark_gray.png": { hand: "off-white.png", side_hand: "off-white.png" },
	},
	bunny: {
		"black.png": { hand: "black.png", side_hand: "black.png" },
		"blue.png": { hand: "deep_blue.png", side_hand: "deep_blue.png" },
		"dark_brown.png": { hand: "dark_brown.png", side_hand: "dark_brown.png" },
		"devil_bunny.png": { hand: "devil_bunny_hand.png", side_hand: "pink.png" },
		"light_brown.png": { hand: "brown.png", side_hand: "brown.png" },
		"mustard.png": { hand: "mustard_yellow.png", side_hand: "mustard_yellow.png" },
		"pink.png": { hand: "mauve_pink.png", side_hand: "mauve_pink.png" },
		"sage.png": { hand: "sage_green.png", side_hand: "sage_green.png" },
		"white.png": { hand: "light_grey.png", side_hand: "light_grey.png" },
	},
	fox: {
		"fox_black.png": { hand: "fox_black.png", side_hand: "fox_black.png" },
		"fox_mixed.png": { hand: "fox_white.png", side_hand: "fox_white.png" },
		"fox_orange.png": { hand: "peach.png", side_hand: "peach.png" },
		"fox_white.png": { hand: "fox_white.png", side_hand: "fox_white.png" },
	},
	chogstar: {
		"black.png": { hand: "black.png", side_hand: "black.png" },
		"brown_1.png": { hand: "cocoa_brown.png", side_hand: "cocoa_brown.png" },
		"brown_2.png": { hand: "brown.png", side_hand: "brown.png" },
		"dark.png": { hand: "deep_navy_blue.png", side_hand: "deep_navy_blue.png" },
		"nude.png": { hand: "soft_beige.png", side_hand: "soft_beige.png" },
		"orange.png": { hand: "amber.png", side_hand: "amber.png" },
		"pink.png": { hand: "pink.png", side_hand: "pink.png" },
		"pitch_black.png": { hand: "deep_black.png", side_hand: "deep_black.png" },
		"purple.png": { hand: "purple.png", side_hand: "purple.png" },
		"smoke.png": { hand: "charcoal_black.png", side_hand: "charcoal_black.png" },
		"white.png": { hand: "pure_white.png", side_hand: "pure_white.png" },
	},
};

// For legendary, hand/side_hand are special effects (not color-matched)
export const LEGENDARY_HAND_MATCHING = false;

// Layer position offsets (in pixels, for 2048x2048 canvas)
// Use this to adjust positioning of specific layers
export const LAYER_OFFSETS: Partial<Record<LayerType, { top: number; left: number }>> = {
	// Adjust side_hand position to align with side_hand_accessories
	// Positive values move down/right, negative values move up/left
	side_hand: { top: 0, left: 0 },
	// side_hand_accessories: { top: 0, left: 0 },
};

export interface TraitMetadata {
	layer: LayerType;
	name: string;
	filename: string;
	rarity: Rarity;
}

export interface NFTMetadata {
	tokenId: number;
	name: string;
	description: string;
	image: string;
	attributes: Array<{
		trait_type: string;
		value: string;
	}>;
	character: CharacterType;
	rarity: Rarity;
	traits: TraitMetadata[];
}
