import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const COMMON_PATH = join(import.meta.dir, "../../output/common");
const OUTPUT_PATH = join(
	import.meta.dir,
	"../../output/common_redistributed_v3",
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
	shirtName: string | null;
	metadata: any;
}

function toFileName(traitName: string): string {
	return traitName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

function toTraitName(fileName: string): string {
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

function isLegendaryShirt(name: string): boolean {
	return LEGENDARY_SHIRTS.some((l) => l.toLowerCase() === name.toLowerCase());
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
			"Hand Accessories": ["hand_accessories", "side_hand_accessories"], // Check both folders
			"Side Hand": [`side_hand_${character}`],
			"Side Hand Accessories": ["side_hand_accessories"],
		};

		// Legendary folders have different names for some traits
		const legendaryFolderMap: Record<string, string[]> = {
			Background: ["background"],
			Shirt: ["clothes"],
			Eyes: ["eyes"],
			"Hand Accessories": [
				"hand_accessories_gold",
				"side_hand_accessories_gold",
			],
		};

		const folders = folderMap[traitType] || [
			traitType.toLowerCase().replace(/ /g, "_"),
		];
		const legendaryFolders = legendaryFolderMap[traitType] || folders;

		// First check traits folders
		for (const folder of folders) {
			const testPath = join(ASSETS_PATH, folder, fileName);
			if (existsSync(testPath)) {
				layerPath = testPath;
				break;
			}
		}

		// Then check legendary folders
		if (!layerPath) {
			for (const folder of legendaryFolders) {
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
							: layerName === "hand_accessories"
								? "hand_accessories"
								: // Render BEFORE side_hand (hand holds accessory)
									layerName,
			);
			layers.push({ path: layerPath, zIndex: zIndex >= 0 ? zIndex : 99 });
		}
	}

	layers.sort((a, b) => a.zIndex - b.zIndex);

	if (layers.length === 0) {
		console.log("  Warning: No layers found");
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
	console.log("=== SHIRT REDISTRIBUTION V3 ===\n");

	// Get available shirts
	const chogstarShirts = getAvailableShirts("chogstar").filter(
		(s) => !isLegendaryShirt(s),
	);
	const bearBunnyFoxShirts = getAvailableShirts("bear").filter(
		(s) => !isLegendaryShirt(s),
	);

	console.log(`Chogstar common shirts: ${chogstarShirts.length}`);
	console.log(`Bear/Bunny/Fox common shirts: ${bearBunnyFoxShirts.length}\n`);

	// Collect all NFTs
	const allNFTs: NFTInfo[] = [];

	for (const char of characters) {
		const metadataPath = join(COMMON_PATH, char, "metadata");
		if (!existsSync(metadataPath)) continue;

		const files = readdirSync(metadataPath).filter((f) => f.endsWith(".json"));

		for (const file of files) {
			const metadata = await Bun.file(join(metadataPath, file)).json();
			const shirtAttr = metadata.attributes.find(
				(a: any) => a.trait_type === "Shirt",
			);
			const shirtName =
				shirtAttr?.value && shirtAttr.value !== "None" ? shirtAttr.value : null;

			allNFTs.push({
				tokenId: file.replace(".json", ""),
				character: char,
				shirtName,
				metadata,
			});
		}
	}

	// Process each character group
	const allChanges: {
		nft: NFTInfo;
		newShirt: string;
		action: "add" | "change";
	}[] = [];

	for (const groupName of ["chogstar", "bearBunnyFox"] as const) {
		const isChogstar = groupName === "chogstar";
		const nfts = allNFTs.filter((n) =>
			isChogstar ? n.character === "chogstar" : n.character !== "chogstar",
		);
		const availableShirts = isChogstar ? chogstarShirts : bearBunnyFoxShirts;

		// Calculate target based on total NFTs that CAN have shirts
		const withShirt = nfts.filter((n) => n.shirtName !== null);
		const withoutShirt = nfts.filter((n) => n.shirtName === null);
		const totalSlots = nfts.length; // All NFTs can potentially have a shirt
		const targetPerShirt = Math.floor(totalSlots / availableShirts.length);

		console.log(`\n=== ${groupName.toUpperCase()} ===`);
		console.log(`Total NFTs: ${nfts.length}`);
		console.log(`With shirt: ${withShirt.length}`);
		console.log(`Without shirt: ${withoutShirt.length}`);
		console.log(`Available shirt types: ${availableShirts.length}`);
		console.log(`Target per shirt: ${targetPerShirt}`);

		// Count current shirt distribution (excluding legendary)
		const shirtCounts: Record<string, number> = {};
		for (const shirt of availableShirts) {
			shirtCounts[shirt] = 0;
		}
		for (const nft of withShirt) {
			if (nft.shirtName && !isLegendaryShirt(nft.shirtName)) {
				const normalized = availableShirts.find(
					(s) => s.toLowerCase() === nft.shirtName?.toLowerCase(),
				);
				if (normalized) {
					shirtCounts[normalized] = (shirtCounts[normalized] || 0) + 1;
				}
			}
		}

		// Step 1: Assign shirts to NFTs without shirts
		const needMore = availableShirts
			.map((name) => ({
				name,
				current: shirtCounts[name],
				needed: Math.max(0, targetPerShirt - shirtCounts[name]),
			}))
			.filter((s) => s.needed > 0)
			.sort((a, b) => b.needed - a.needed);

		let assignedToEmpty = 0;
		const emptyNFTs = [...withoutShirt];

		for (const target of needMore) {
			while (target.needed > 0 && emptyNFTs.length > 0) {
				const nft = emptyNFTs.shift()!;
				allChanges.push({ nft, newShirt: target.name, action: "add" });
				shirtCounts[target.name]++;
				target.needed--;
				assignedToEmpty++;
			}
		}

		console.log(`Assigned shirts to ${assignedToEmpty} NFTs without shirts`);

		// Step 2: Redistribute from high-count to still-low-count
		const canGive = availableShirts
			.map((name) => ({
				name,
				current: shirtCounts[name],
				excess: Math.max(0, shirtCounts[name] - targetPerShirt),
			}))
			.filter((s) => s.excess > 0)
			.sort((a, b) => b.excess - a.excess);

		const stillNeedMore = availableShirts
			.map((name) => ({
				name,
				current: shirtCounts[name],
				needed: Math.max(0, targetPerShirt - shirtCounts[name]),
			}))
			.filter((s) => s.needed > 0)
			.sort((a, b) => b.needed - a.needed);

		let redistributed = 0;

		for (const target of stillNeedMore) {
			for (const source of canGive) {
				if (target.needed <= 0) break;

				const available = shirtCounts[source.name] - targetPerShirt;
				if (available <= 0) continue;

				const toTake = Math.min(target.needed, available);

				const nftsWithShirt = nfts.filter(
					(n) =>
						n.shirtName?.toLowerCase() === source.name.toLowerCase() &&
						!allChanges.some((c) => c.nft.tokenId === n.tokenId),
				);

				for (let i = 0; i < toTake && i < nftsWithShirt.length; i++) {
					allChanges.push({
						nft: nftsWithShirt[i],
						newShirt: target.name,
						action: "change",
					});
					shirtCounts[source.name]--;
					shirtCounts[target.name]++;
					target.needed--;
					redistributed++;
				}
			}
		}

		console.log(`Redistributed ${redistributed} shirts`);

		// Show new distribution stats
		const counts = Object.values(shirtCounts);
		const min = Math.min(...counts);
		const max = Math.max(...counts);
		console.log(`New distribution: min=${min}, max=${max}`);
	}

	console.log(`\n=== TOTAL CHANGES: ${allChanges.length} ===\n`);

	// Create output directories
	console.log("Creating output directories...");
	for (const char of characters) {
		mkdirSync(join(OUTPUT_PATH, char, "metadata"), { recursive: true });
		mkdirSync(join(OUTPUT_PATH, char, "images"), { recursive: true });
	}

	// Apply changes
	console.log("Applying changes...\n");

	let processed = 0;
	for (const change of allChanges) {
		const { nft, newShirt, action } = change;

		// Update metadata
		const newMetadata = JSON.parse(JSON.stringify(nft.metadata));
		const shirtAttr = newMetadata.attributes.find(
			(a: any) => a.trait_type === "Shirt",
		);

		if (action === "add") {
			// Add shirt attribute
			if (!shirtAttr) {
				newMetadata.attributes.push({ trait_type: "Shirt", value: newShirt });
			} else {
				shirtAttr.value = newShirt;
			}
		} else {
			// Change existing shirt
			if (shirtAttr) {
				shirtAttr.value = newShirt;
			}
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
		if (processed % 100 === 0 || processed === allChanges.length) {
			console.log(
				`  Processed ${processed}/${allChanges.length} (${((processed / allChanges.length) * 100).toFixed(1)}%)`,
			);
		}
	}

	// Save change log
	const changeLog = allChanges.map((c) => ({
		tokenId: c.nft.tokenId,
		character: c.nft.character,
		oldShirt: c.nft.shirtName || "None",
		newShirt: c.newShirt,
		action: c.action,
	}));

	writeFileSync(
		join(OUTPUT_PATH, "redistribution_log.json"),
		JSON.stringify(changeLog, null, 2),
	);

	// Summary
	const addCount = allChanges.filter((c) => c.action === "add").length;
	const changeCount = allChanges.filter((c) => c.action === "change").length;

	console.log(`\n=== COMPLETE ===`);
	console.log(`Added shirts: ${addCount}`);
	console.log(`Changed shirts: ${changeCount}`);
	console.log(`Output: ${OUTPUT_PATH}`);
}

redistributeShirts().catch(console.error);
