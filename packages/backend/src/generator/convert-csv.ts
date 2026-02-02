import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_PATH = join(import.meta.dir, "../../output");

const report = JSON.parse(
	readFileSync(join(OUTPUT_PATH, "rarity_report.json"), "utf-8"),
);

const lines: string[] = [];

for (const [traitType, values] of Object.entries(
	report.traitDistribution as Record<string, Record<string, number>>,
)) {
	// Skip Rarity and Character as they're meta info
	if (traitType === "Rarity" || traitType === "Character") continue;

	// Header
	lines.push(traitType);
	lines.push("Nama Traits,Weight (%)");

	// Calculate total for this trait type
	const total = Object.values(values).reduce((a, b) => a + b, 0);

	// Each trait
	for (const [name, count] of Object.entries(values)) {
		const weight = ((count / total) * 100).toFixed(0);
		lines.push(`${name},${weight}`);
	}

	// Total row
	lines.push("Total,100");
	lines.push("");
}

writeFileSync(join(OUTPUT_PATH, "rarity_report.csv"), lines.join("\n"));
console.log("CSV saved with new layout");
