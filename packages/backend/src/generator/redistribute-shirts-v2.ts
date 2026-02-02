import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const COMMON_PATH = join(import.meta.dir, "../../output/common");
const OUTPUT_PATH = join(
	import.meta.dir,
	"../../output/common_redistributed_v2",
);
const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");

const characters = ["bear", "bunny", "fox", "chogstar"] as const;
type CharacterType = (typeof characters)[number];

const LEGENDARY_SHIRTS = [
	"Outfit Cutegoldenstar",
	"Outfit Shark",
	"Outfit Cutestar",
	"Outfit Greenfrog",
	"Outfit Line",
	"Outfit Goldensweater",
	"Outfit Dino",
];

const MIN_TARGET = 40;

// Layer order for image compositing
const LAYER_ORDER = [
	"background",
	"base",
	"clothes",
	"necklaces",
	"mouth",
	"eyes",
	"eyeglasses",
	"head_acc",
	"hand",
	"hand_accessories",
	"side_hand",
	"side_hand_accessories",
];

interface NFTInfo {
	tokenId: string;
	character: CharacterType;
	shirtName: string;
	metadata: any;
	metadataPath: string;
	imagePath: string;
}

function toFileName(traitName: string): string {
	return traitName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

function toTraitName(fileName: string): string {
	// Convert file name to trait name (capitalize words)
	return fileName
		.replace(".png", "")
		.split("_")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
		.replace(/ {2,}/g, " ")
		.trim();
}

function getShirtFolder(character: CharacterType): string {
	return character === "chogstar" ? "shirt_chogstar" : "shirt_bear_bunny_fox";
}

function getAvailableShirts(character: CharacterType): string[] {
	const folder = getShirtFolder(character);
	const folderPath = join(ASSETS_PATH, folder);
	return readdirSync(folderPath)
		.filter((f) => f.endsWith(".png"))
		.map((f) => toTraitName(f));
}

async function regenerateImage(
	metadata: any,
	character: CharacterType,
	outputImagePath: string,
) {
	const layers: { path: string; zIndex: number }[] = [];

	const shirtFolder =
		character === "chogstar" ? "shirt_chogstar" : "shirt_bear_bunny_fox";
	const headAccFolder =
		character === "chogstar" ? "head_acc_chogstar" : "head_acc_bear_bunny_fox";

	for (const attr of metadata.attributes) {
		const traitType = attr.trait_type;
		const value = attr.value;

		if (traitType === "Rarity" || traitType === "Character" || !value) continue;

		let layerPath: string | null = null;
		const fileName = `${toFileName(value)}.png`;

		const folderMap: Record<string, string[]> = {
			Background: ["background"],
			Base: [`base_${character}`],
			Shirt: [shirtFolder],
			Necklace: ["necklaces"],
			Mouth: ["mouth"],
			Eyes: ["eyes"],
			Eyeglasses: ["eyeglasses"],
			"Head Accessory": [headAccFolder],
			Hand: [`hand_${character}`],
			"Hand Accessories": ["hand_accessories"],
			"Side Hand": [`side_hand_${character}`],
			"Side Hand Accessories": ["side_hand_accessories"],
		};

		const folders = folderMap[traitType] || [
			traitType.toLowerCase().replace(/ /g, "_"),
		];

		for (const folder of folders) {
			const testPath = join(ASSETS_PATH, folder, fileName);
			if (existsSync(testPath)) {
				layerPath = testPath;
				break;
			}
			// Try legendary folder for inherited traits
			const legendaryPath = join(
				import.meta.dir,
				"../../assets/art/legendary",
				folder,
				fileName,
			);
			if (existsSync(legendaryPath)) {
				layerPath = legendaryPath;
				break;
			}
		}

		if (layerPath) {
			const layerName = traitType.toLowerCase().replace(/ /g, "_");
			const zIndex = LAYER_ORDER.indexOf(
				layerName === "shirt"
					? "clothes"
					: layerName === "necklace"
						? "necklaces"
						: layerName === "head_accessory"
							? "head_acc"
							: layerName,
			);
			layers.push({ path: layerPath, zIndex: zIndex >= 0 ? zIndex : 99 });
		}
	}

	layers.sort((a, b) => a.zIndex - b.zIndex);

	if (layers.length === 0) {
		console.log("  Warning: No layers found for regeneration");
		return;
	}

	let composite = sharp(layers[0].path);

	if (layers.length > 1) {
		const overlays = await Promise.all(
			layers.slice(1).map(async (layer) => ({
				input: await sharp(layer.path).toBuffer(),
			})),
		);
		composite = composite.composite(overlays);
	}

	await composite.png().toFile(outputImagePath);
}

async function redistributeShirts() {
	console.log("=== SHIRT REDISTRIBUTION V2 (Character-Aware) ===\n");

	// Get available shirts per character type
	const bearBunnyFoxShirts = getAvailableShirts("bear");
	const chogstarShirts = getAvailableShirts("chogstar");

	console.log(`Bear/Bunny/Fox shirts available: ${bearBunnyFoxShirts.length}`);
	console.log(`Chogstar shirts available: ${chogstarShirts.length}\n`);

	// Step 1: Collect all NFT info, grouped by character type
	const nftsByCharGroup: { bearBunnyFox: NFTInfo[]; chogstar: NFTInfo[] } = {
		bearBunnyFox: [],
		chogstar: [],
	};

	const shirtCountsByGroup: {
		bearBunnyFox: Record<string, number>;
		chogstar: Record<string, number>;
	} = {
		bearBunnyFox: {},
		chogstar: {},
	};

	for (const char of characters) {
		const metadataPath = join(COMMON_PATH, char, "metadata");
		if (!existsSync(metadataPath)) continue;

		const files = readdirSync(metadataPath).filter((f) => f.endsWith(".json"));
		const group = char === "chogstar" ? "chogstar" : "bearBunnyFox";

		for (const file of files) {
			const fullPath = join(metadataPath, file);
			const metadata = await Bun.file(fullPath).json();
			const shirtAttr = metadata.attributes.find(
				(a: any) => a.trait_type === "Shirt",
			);
			const shirtName = shirtAttr?.value || "None";

			nftsByCharGroup[group].push({
				tokenId: file.replace(".json", ""),
				character: char,
				shirtName,
				metadata,
				metadataPath: fullPath,
				imagePath: join(
					COMMON_PATH,
					char,
					"images",
					file.replace(".json", ".png"),
				),
			});

			if (shirtName !== "None") {
				shirtCountsByGroup[group][shirtName] =
					(shirtCountsByGroup[group][shirtName] || 0) + 1;
			}
		}
	}

	console.log(`Bear/Bunny/Fox NFTs: ${nftsByCharGroup.bearBunnyFox.length}`);
	console.log(`Chogstar NFTs: ${nftsByCharGroup.chogstar.length}\n`);

	// Step 2: Calculate redistribution for each group
	const allChanges: { nft: NFTInfo; newShirt: string }[] = [];

	for (const groupName of ["bearBunnyFox", "chogstar"] as const) {
		const nfts = nftsByCharGroup[groupName];
		const shirtCounts = { ...shirtCountsByGroup[groupName] };
		const availableShirts =
			groupName === "chogstar" ? chogstarShirts : bearBunnyFoxShirts;

		console.log(`\n=== Processing ${groupName} group ===`);

		// Filter to only common shirts (not legendary, available in assets)
		const _isCommonShirt = (name: string) =>
			!LEGENDARY_SHIRTS.some((l) => l.toLowerCase() === name.toLowerCase()) &&
			availableShirts.some((s) => s.toLowerCase() === name.toLowerCase());

		const needMore: { name: string; current: number; needed: number }[] = [];
		const canGive: { name: string; current: number; excess: number }[] = [];

		// Check all available shirts
		for (const shirtName of availableShirts) {
			if (
				LEGENDARY_SHIRTS.some(
					(l) => l.toLowerCase() === shirtName.toLowerCase(),
				)
			)
				continue;

			const count = shirtCounts[shirtName] || 0;
			if (count < MIN_TARGET) {
				needMore.push({
					name: shirtName,
					current: count,
					needed: MIN_TARGET - count,
				});
			} else if (count > MIN_TARGET) {
				canGive.push({
					name: shirtName,
					current: count,
					excess: count - MIN_TARGET,
				});
			}
		}

		needMore.sort((a, b) => b.needed - a.needed);
		canGive.sort((a, b) => b.excess - a.excess);

		const totalNeeded = needMore.reduce((sum, s) => sum + s.needed, 0);
		const totalExcess = canGive.reduce((sum, s) => sum + s.excess, 0);

		console.log(
			`Shirts needing boost: ${needMore.length} types, total +${totalNeeded}`,
		);
		console.log(
			`Shirts with excess: ${canGive.length} types, total -${totalExcess}`,
		);

		if (totalExcess < totalNeeded) {
			console.log(
				`WARNING: Not enough excess in ${groupName}! May not reach target for all.`,
			);
		}

		// Create redistribution plan
		const newShirtCounts = { ...shirtCounts };

		for (const target of needMore) {
			let stillNeeded = target.needed;

			for (const source of canGive) {
				if (stillNeeded <= 0) break;

				const available = newShirtCounts[source.name] - MIN_TARGET;
				if (available <= 0) continue;

				const toTake = Math.min(stillNeeded, available);

				const nftsWithShirt = nfts.filter(
					(n) =>
						n.shirtName.toLowerCase() === source.name.toLowerCase() &&
						!allChanges.some((c) => c.nft.tokenId === n.tokenId),
				);

				for (let i = 0; i < toTake && i < nftsWithShirt.length; i++) {
					allChanges.push({ nft: nftsWithShirt[i], newShirt: target.name });
					newShirtCounts[source.name]--;
					newShirtCounts[target.name] = (newShirtCounts[target.name] || 0) + 1;
					stillNeeded--;
				}
			}

			if (stillNeeded > 0) {
				console.log(`  Note: ${target.name} still needs ${stillNeeded} more`);
			}
		}
	}

	console.log(`\n=== TOTAL CHANGES: ${allChanges.length} NFTs ===\n`);

	// Step 3: Create output directories
	console.log("Creating output directories...");
	for (const char of characters) {
		mkdirSync(join(OUTPUT_PATH, char, "metadata"), { recursive: true });
		mkdirSync(join(OUTPUT_PATH, char, "images"), { recursive: true });
	}

	// Step 4: Apply changes
	console.log("Applying changes...\n");

	let processed = 0;
	for (const change of allChanges) {
		const { nft, newShirt } = change;

		// Update metadata
		const newMetadata = JSON.parse(JSON.stringify(nft.metadata));
		const shirtAttr = newMetadata.attributes.find(
			(a: any) => a.trait_type === "Shirt",
		);
		if (shirtAttr) {
			shirtAttr.value = newShirt;
		}

		// Save metadata
		const newMetadataPath = join(
			OUTPUT_PATH,
			nft.character,
			"metadata",
			`${nft.tokenId}.json`,
		);
		writeFileSync(newMetadataPath, JSON.stringify(newMetadata, null, 2));

		// Regenerate image
		const newImagePath = join(
			OUTPUT_PATH,
			nft.character,
			"images",
			`${nft.tokenId}.png`,
		);
		await regenerateImage(newMetadata, nft.character, newImagePath);

		processed++;
		if (processed % 50 === 0 || processed === allChanges.length) {
			console.log(
				`  Processed ${processed}/${allChanges.length} (${((processed / allChanges.length) * 100).toFixed(1)}%)`,
			);
		}
	}

	// Step 5: Save change log
	const changeLog = allChanges.map((c) => ({
		tokenId: c.nft.tokenId,
		character: c.nft.character,
		oldShirt: c.nft.shirtName,
		newShirt: c.newShirt,
	}));

	writeFileSync(
		join(OUTPUT_PATH, "redistribution_log.json"),
		JSON.stringify(changeLog, null, 2),
	);

	console.log(`\n=== COMPLETE ===`);
	console.log(`Modified NFTs saved to: ${OUTPUT_PATH}`);
	console.log(`Change log: ${join(OUTPUT_PATH, "redistribution_log.json")}`);
}

redistributeShirts().catch(console.error);
