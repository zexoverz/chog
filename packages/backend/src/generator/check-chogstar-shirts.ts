import { readdirSync } from "node:fs";
import { join } from "node:path";

const COMMON_PATH = join(import.meta.dir, "../../output/common");

async function checkChogstarShirts() {
	const metadataPath = join(COMMON_PATH, "chogstar", "metadata");
	const files = readdirSync(metadataPath).filter((f) => f.endsWith(".json"));

	let withShirt = 0;
	let withoutShirt = 0;
	const shirtCounts: Record<string, number> = {};

	for (const file of files) {
		const metadata = await Bun.file(join(metadataPath, file)).json();
		const shirtAttr = metadata.attributes.find(
			(a: any) => a.trait_type === "Shirt",
		);

		if (shirtAttr?.value && shirtAttr.value !== "None") {
			withShirt++;
			shirtCounts[shirtAttr.value] = (shirtCounts[shirtAttr.value] || 0) + 1;
		} else {
			withoutShirt++;
		}
	}

	console.log("=== CHOGSTAR SHIRT ANALYSIS ===");
	console.log(`Total chogstar NFTs: ${files.length}`);
	console.log(`With shirt: ${withShirt}`);
	console.log(`Without shirt (None): ${withoutShirt}`);
	console.log("");
	console.log(`Unique shirt types used: ${Object.keys(shirtCounts).length}`);

	const availableSlots = withShirt;
	const shirtTypes = Object.keys(shirtCounts).length;
	const maxPerShirt = Math.floor(availableSlots / shirtTypes);

	console.log("");
	console.log("=== MATH ===");
	console.log(`Available shirt slots: ${availableSlots}`);
	console.log(`Shirt types used: ${shirtTypes}`);
	console.log(`Max per shirt if evenly distributed: ~${maxPerShirt}`);

	// Check available shirt assets
	const shirtAssetPath = join(
		import.meta.dir,
		"../../assets/art/traits/shirt_chogstar",
	);
	const shirtAssets = readdirSync(shirtAssetPath).filter((f) =>
		f.endsWith(".png"),
	);
	console.log(`\nShirt assets available: ${shirtAssets.length}`);

	const sorted = Object.entries(shirtCounts).sort((a, b) => a[1] - b[1]);
	console.log("");
	console.log("Lowest 15 shirts:");
	for (const [name, count] of sorted.slice(0, 15)) {
		console.log(`  ${name}: ${count}`);
	}
	console.log("");
	console.log("Highest 10 shirts:");
	for (const [name, count] of sorted.slice(-10)) {
		console.log(`  ${name}: ${count}`);
	}

	// Calculate deficit with target of 28 (more realistic for chogstar)
	const TARGET = 28;
	let totalDeficit = 0;
	const shirtsNeedingBoost = [];
	for (const [name, count] of sorted) {
		if (count < TARGET) {
			const deficit = TARGET - count;
			totalDeficit += deficit;
			shirtsNeedingBoost.push({ name, count, deficit });
		}
	}

	console.log("");
	console.log(`=== WITH TARGET OF ${TARGET} ===`);
	console.log(`Shirts needing boost: ${shirtsNeedingBoost.length}`);
	console.log(`Total deficit: +${totalDeficit}`);

	// Also check bear/bunny/fox
	console.log("\n\n=== BEAR/BUNNY/FOX ANALYSIS ===");
	let bbfWithShirt = 0;
	let bbfWithoutShirt = 0;

	for (const char of ["bear", "bunny", "fox"]) {
		const charMetadataPath = join(COMMON_PATH, char, "metadata");
		const charFiles = readdirSync(charMetadataPath).filter((f) =>
			f.endsWith(".json"),
		);

		for (const file of charFiles) {
			const metadata = await Bun.file(join(charMetadataPath, file)).json();
			const shirtAttr = metadata.attributes.find(
				(a: any) => a.trait_type === "Shirt",
			);

			if (shirtAttr?.value && shirtAttr.value !== "None") {
				bbfWithShirt++;
			} else {
				bbfWithoutShirt++;
			}
		}
	}

	console.log(`Bear/Bunny/Fox with shirt: ${bbfWithShirt}`);
	console.log(`Bear/Bunny/Fox without shirt: ${bbfWithoutShirt}`);
}

checkChogstarShirts().catch(console.error);
