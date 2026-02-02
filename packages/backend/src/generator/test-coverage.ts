import { readdirSync } from "node:fs";
import { join } from "node:path";
import { type CharacterType, COLOR_MATCHING_COMMON } from "./config";

const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");

const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

console.log("=== Common Base/Hand Color Coverage Test ===\n");

let hasErrors = false;

for (const char of characters) {
	console.log(`\n--- ${char.toUpperCase()} ---`);

	// Get actual base files
	const baseDir = join(ASSETS_PATH, `base_${char}`);
	const baseFiles = readdirSync(baseDir).filter((f) => f.endsWith(".png"));

	// Get actual hand files
	const handDir = join(ASSETS_PATH, `hand_${char}`);
	const handFiles = readdirSync(handDir).filter((f) => f.endsWith(".png"));

	// Get actual side_hand files
	const sideHandDir = join(ASSETS_PATH, `side_hand_${char}`);
	const sideHandFiles = readdirSync(sideHandDir).filter((f) =>
		f.endsWith(".png"),
	);

	console.log(`  Base files: ${baseFiles.length}`);
	console.log(`  Hand files: ${handFiles.length}`);
	console.log(`  Side hand files: ${sideHandFiles.length}`);

	// Get config mapping
	const colorMapping = COLOR_MATCHING_COMMON[char];
	const configBases = Object.keys(colorMapping);

	console.log(`  Config mappings: ${configBases.length}`);

	// Check for missing mappings
	const missingInConfig = baseFiles.filter((f) => !configBases.includes(f));
	const extraInConfig = configBases.filter((f) => !baseFiles.includes(f));

	if (missingInConfig.length > 0) {
		console.log(`\n  ❌ Base files WITHOUT config mapping:`);
		missingInConfig.forEach((f) => console.log(`     - ${f}`));
		hasErrors = true;
	}

	if (extraInConfig.length > 0) {
		console.log(`\n  ⚠️  Config entries WITHOUT base file:`);
		extraInConfig.forEach((f) => console.log(`     - ${f}`));
		hasErrors = true;
	}

	// Check if mapped hand files exist
	const missingHands: string[] = [];
	const missingSideHands: string[] = [];

	for (const [base, mapping] of Object.entries(colorMapping)) {
		if (!handFiles.includes(mapping.hand)) {
			missingHands.push(`${base} -> ${mapping.hand}`);
		}
		if (!sideHandFiles.includes(mapping.side_hand)) {
			missingSideHands.push(`${base} -> ${mapping.side_hand}`);
		}
	}

	if (missingHands.length > 0) {
		console.log(`\n  ❌ Missing HAND files:`);
		missingHands.forEach((m) => console.log(`     - ${m}`));
		hasErrors = true;
	}

	if (missingSideHands.length > 0) {
		console.log(`\n  ❌ Missing SIDE_HAND files:`);
		missingSideHands.forEach((m) => console.log(`     - ${m}`));
		hasErrors = true;
	}

	if (
		missingInConfig.length === 0 &&
		extraInConfig.length === 0 &&
		missingHands.length === 0 &&
		missingSideHands.length === 0
	) {
		console.log(`\n  ✅ All mappings OK!`);
	}
}

console.log(`\n${"=".repeat(50)}`);
if (hasErrors) {
	console.log("❌ Coverage test FAILED - fix issues above");
} else {
	console.log("✅ Coverage test PASSED - all base/hand mappings are complete");
}
