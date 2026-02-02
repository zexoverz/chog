import sharp from "sharp";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import {
	type CharacterType,
	type LayerType,
	LAYER_ORDER_LEGENDARY,
	LAYER_ORDER_COMMON,
	LAYER_OFFSETS,
} from "./config";
import type { SelectedTraits } from "./random";
import { getTraitPath } from "./traits";

const OUTPUT_PATH = join(import.meta.dir, "../../output");
const IMAGE_SIZE = 2048; // Output image size

export async function ensureOutputDirs(): Promise<void> {
	await mkdir(join(OUTPUT_PATH, "images"), { recursive: true });
	await mkdir(join(OUTPUT_PATH, "metadata"), { recursive: true });
}

async function resizeLayer(inputPath: string, size: number): Promise<Buffer> {
	return sharp(inputPath)
		.resize(size, size, { fit: "fill" })
		.png()
		.toBuffer();
}

export async function generateImage(
	selection: SelectedTraits,
	tokenId: number,
): Promise<string> {
	const layers: Array<{ path: string; layer: LayerType }> = [];

	const layerOrder =
		selection.rarity === "legendary"
			? LAYER_ORDER_LEGENDARY
			: LAYER_ORDER_COMMON;

	console.log(`\n=== Token ${tokenId} layers ===`);

	// Collect all layer paths in order
	for (const layer of layerOrder) {
		const trait = selection.traits.get(layer);
		if (!trait) {
			console.log(`  ${layer}: SKIPPED (no trait)`);
			continue;
		}

		const path = getTraitPath(
			selection.character,
			layer,
			trait.filename,
			selection.rarity,
		);
		const offset = LAYER_OFFSETS[layer];
		console.log(`  ${layer}: ${trait.filename}${offset ? ` [offset: top=${offset.top}, left=${offset.left}]` : ""}`);
		layers.push({ path, layer });
	}

	console.log(`  Total layers: ${layers.length}`);

	if (layers.length === 0) {
		throw new Error(`No layers found for token ${tokenId}`);
	}

	// Resize all layers to same size
	const [baseLayer, ...overlayLayers] = layers;
	const resizedOverlays = await Promise.all(
		overlayLayers.map(async (l) => ({
			buffer: await resizeLayer(l.path, IMAGE_SIZE),
			layer: l.layer,
		})),
	);

	let composite = sharp(baseLayer.path).resize(IMAGE_SIZE, IMAGE_SIZE, {
		fit: "fill",
	});

	// Add remaining layers (pre-resized) with position offsets
	if (resizedOverlays.length > 0) {
		composite = composite.composite(
			resizedOverlays.map(({ buffer, layer }) => {
				const offset = LAYER_OFFSETS[layer] || { top: 0, left: 0 };
				return {
					input: buffer,
					top: offset.top,
					left: offset.left,
				};
			}),
		);
	}

	const outputPath = join(OUTPUT_PATH, "images", `${tokenId}.png`);
	await composite.png({ quality: 90 }).toFile(outputPath);

	return outputPath;
}

export async function generateThumbnail(
	tokenId: number,
	size: number = 512,
): Promise<string> {
	const inputPath = join(OUTPUT_PATH, "images", `${tokenId}.png`);
	const outputPath = join(OUTPUT_PATH, "images", `${tokenId}_thumb.png`);

	await sharp(inputPath)
		.resize(size, size)
		.png({ quality: 80 })
		.toFile(outputPath);

	return outputPath;
}

export async function generatePreview(
	selection: SelectedTraits,
): Promise<Buffer> {
	const PREVIEW_SIZE = 512;
	const SCALE = PREVIEW_SIZE / IMAGE_SIZE; // Scale factor for offsets
	const layers: Array<{ path: string; layer: LayerType }> = [];

	const layerOrder =
		selection.rarity === "legendary"
			? LAYER_ORDER_LEGENDARY
			: LAYER_ORDER_COMMON;

	for (const layer of layerOrder) {
		const trait = selection.traits.get(layer);
		if (!trait) continue;

		const path = getTraitPath(
			selection.character,
			layer,
			trait.filename,
			selection.rarity,
		);
		layers.push({ path, layer });
	}

	if (layers.length === 0) {
		throw new Error("No layers found for preview");
	}

	// Resize all layers to same size
	const [baseLayer, ...overlayLayers] = layers;
	const resizedOverlays = await Promise.all(
		overlayLayers.map(async (l) => ({
			buffer: await resizeLayer(l.path, PREVIEW_SIZE),
			layer: l.layer,
		})),
	);

	let composite = sharp(baseLayer.path).resize(PREVIEW_SIZE, PREVIEW_SIZE, {
		fit: "fill",
	});

	if (resizedOverlays.length > 0) {
		composite = composite.composite(
			resizedOverlays.map(({ buffer, layer }) => {
				const offset = LAYER_OFFSETS[layer] || { top: 0, left: 0 };
				return {
					input: buffer,
					top: Math.round(offset.top * SCALE),
					left: Math.round(offset.left * SCALE),
				};
			}),
		);
	}

	return composite.png().toBuffer();
}
