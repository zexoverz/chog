import { readdirSync } from "node:fs";
import { join } from "node:path";

const COMMON_PATH = join(import.meta.dir, "../../output/common");

async function findSideHandExamples() {
	let sideHandCount = 0;
	let handAccCount = 0;
	let bothCount = 0;

	for (const char of ["bear", "bunny", "fox", "chogstar"] as const) {
		const metadataPath = join(COMMON_PATH, char, "metadata");
		const files = readdirSync(metadataPath).filter(f => f.endsWith(".json"));

		for (const file of files) {
			const metadata = await Bun.file(join(metadataPath, file)).json();

			const sideHand = metadata.attributes.find((a: any) => a.trait_type === "Side Hand");
			const handAcc = metadata.attributes.find((a: any) => a.trait_type === "Hand Accessories");

			if (sideHand) sideHandCount++;
			if (handAcc) handAccCount++;
			if (sideHand && handAcc) bothCount++;

			// Show examples with Side Hand
			if (sideHand && sideHandCount <= 3) {
				console.log(`Token: ${file.replace(".json", "")} (${char})`);
				console.log("  All attributes:");
				for (const attr of metadata.attributes) {
					if (attr.trait_type !== "Rarity" && attr.trait_type !== "Character") {
						const marker = attr.trait_type === "Side Hand" ? " <-- SIDE HAND" : "";
						console.log(`    ${attr.trait_type}: ${attr.value}${marker}`);
					}
				}
				console.log("");
			}
		}
	}

	console.log("=== COUNTS ===");
	console.log(`NFTs with Side Hand: ${sideHandCount}`);
	console.log(`NFTs with Hand Accessories: ${handAccCount}`);
	console.log(`NFTs with BOTH: ${bothCount}`);
}

findSideHandExamples().catch(console.error);
