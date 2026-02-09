import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { type Address, isAddress } from "viem";
import {
	type CharacterType,
	COLLECTION_CONFIG,
	generatePreview,
	type LayerType,
	loadTraitDatabase,
	type Rarity,
	SeededRandom,
	selectTraitsForNFT,
	type TraitMetadata,
} from "./generator";
import { MINT_CONFIG, type MintPhase, MintService } from "./mint";
import { MintSigner } from "./signer";

const app = new Hono();

// Legacy signer (for backward compatibility)
const signer = new MintSigner({
	privateKey: (process.env.SIGNER_PRIVATE_KEY as `0x${string}`) || "0x",
	contractAddress:
		(process.env.CONTRACT_ADDRESS as Address) ||
		"0x0000000000000000000000000000000000000000",
	contractName: process.env.CONTRACT_NAME || "Collectible",
	chainId: Number(process.env.CHAIN_ID) || 1,
});

// Mint service for BlindBox/LilStar
const mintService = new MintService({
	signerPrivateKey:
		(process.env.MINT_SIGNER_PRIVATE_KEY as `0x${string}`) ||
		(process.env.SIGNER_PRIVATE_KEY as `0x${string}`) ||
		"0x0000000000000000000000000000000000000000000000000000000000000001",
	blindBoxAddress:
		(process.env.BLINDBOX_ADDRESS as Address) ||
		"0x19c1Fa41821dA8Fb08B879b5185a2bB09e65fBB0",
	adminAddresses: process.env.ADMIN_ADDRESSES
		? (process.env.ADMIN_ADDRESSES.split(",") as Address[])
		: [],
	starlistStartTime: Number(process.env.STARLIST_START_TIME) || 0,
	starlistEndTime: Number(process.env.STARLIST_END_TIME) || 0,
	fcfsStartTime: Number(process.env.FCFS_START_TIME) || 0,
	fcfsEndTime: Number(process.env.FCFS_END_TIME) || 0,
});

app.use("*", cors());

// ==================
// Root
// ==================
app.get("/", (c) => {
	return c.json({
		name: "LilStar Mint API",
		version: "1.0.0",
		signer: signer.signerAddress,
		mintSigner: mintService.signerAddress,
	});
});

// ==================
// Legacy Mint Permit (backward compatibility)
// ==================
app.post("/mint/permit", async (c) => {
	const body = await c.req.json<{ to: string; tokenId: string }>();

	if (!body.to || !isAddress(body.to)) {
		return c.json({ error: "Invalid address" }, 400);
	}

	if (!body.tokenId) {
		return c.json({ error: "Token ID is required" }, 400);
	}

	const tokenId = BigInt(body.tokenId);

	const permit = await signer.signMintPermit(body.to as Address, tokenId);

	return c.json({
		to: permit.to,
		tokenId: permit.tokenId.toString(),
		nonce: permit.nonce.toString(),
		deadline: permit.deadline.toString(),
		signature: permit.signature,
	});
});

// ==================
// BlindBox Mint API
// ==================

// Get mint status
app.get("/mint/status", (c) => {
	const status = mintService.getStatus();
	return c.json(status);
});

// Get mint config
app.get("/mint/config", (c) => {
	return c.json(MINT_CONFIG);
});

// Check eligibility for an address
app.get("/mint/eligibility/:address", (c) => {
	const address = c.req.param("address");

	if (!isAddress(address)) {
		return c.json({ error: "Invalid address" }, 400);
	}

	const eligibility = mintService.checkEligibility(address as Address);
	return c.json(eligibility);
});

// Generate mint signature
app.post("/mint/signature", async (c) => {
	const body = await c.req.json<{ address: string; amount: number }>();

	if (!body.address || !isAddress(body.address)) {
		return c.json({ error: "Invalid address" }, 400);
	}

	if (!body.amount || body.amount <= 0) {
		return c.json({ error: "Invalid amount" }, 400);
	}

	const result = await mintService.generateSignature(
		body.address as Address,
		body.amount,
	);

	if (!result.success) {
		return c.json({ error: result.error }, 400);
	}

	return c.json(result);
});

// Record successful mint (webhook from frontend after on-chain confirmation)
app.post("/mint/record", async (c) => {
	const body = await c.req.json<{
		address: string;
		amount: number;
		txHash?: string;
	}>();

	if (!body.address || !isAddress(body.address)) {
		return c.json({ error: "Invalid address" }, 400);
	}

	if (!body.amount || body.amount <= 0) {
		return c.json({ error: "Invalid amount" }, 400);
	}

	const success = mintService.recordMint(body.address as Address, body.amount);

	return c.json({ success, recorded: body.amount });
});

// ==================
// Admin API
// ==================

// Middleware to check admin auth
const adminAuth = async (c: any, next: any) => {
	const authHeader = c.req.header("Authorization");
	const adminKey = process.env.ADMIN_API_KEY;

	if (!adminKey) {
		return c.json({ error: "Admin API not configured" }, 500);
	}

	if (!authHeader || authHeader !== `Bearer ${adminKey}`) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	await next();
};

// Get starlist info
app.get("/admin/starlist", adminAuth, (c) => {
	const info = mintService.getStarlistInfo();
	return c.json(info);
});

// Add address to starlist
app.post("/admin/starlist", adminAuth, async (c) => {
	const body = await c.req.json<{ address: string; maxAllocation?: number }>();

	if (!body.address || !isAddress(body.address)) {
		return c.json({ error: "Invalid address" }, 400);
	}

	mintService.addToStarlist(body.address as Address, body.maxAllocation);

	return c.json({ success: true, address: body.address });
});

// Bulk add to starlist
app.post("/admin/starlist/bulk", adminAuth, async (c) => {
	const body = await c.req.json<{
		addresses: string[];
		maxAllocation?: number;
	}>();

	if (!body.addresses || !Array.isArray(body.addresses)) {
		return c.json({ error: "Invalid addresses array" }, 400);
	}

	const validAddresses: Address[] = [];
	const invalidAddresses: string[] = [];

	for (const addr of body.addresses) {
		if (isAddress(addr)) {
			validAddresses.push(addr as Address);
		} else {
			invalidAddresses.push(addr);
		}
	}

	mintService.addBulkToStarlist(validAddresses, body.maxAllocation);

	return c.json({
		success: true,
		added: validAddresses.length,
		invalid: invalidAddresses,
	});
});

// Remove from starlist
app.delete("/admin/starlist/:address", adminAuth, (c) => {
	const address = c.req.param("address");

	if (!isAddress(address)) {
		return c.json({ error: "Invalid address" }, 400);
	}

	const success = mintService.removeFromStarlist(address as Address);

	return c.json({ success, address });
});

// Set phase override
app.post("/admin/phase", adminAuth, async (c) => {
	const body = await c.req.json<{ phase: MintPhase | null }>();

	mintService.setPhaseOverride(body.phase);

	return c.json({ success: true, phase: body.phase });
});

// Set phase times
app.post("/admin/phase/times", adminAuth, async (c) => {
	const body = await c.req.json<{
		starlistStart?: number;
		starlistEnd?: number;
		fcfsStart?: number;
		fcfsEnd?: number;
	}>();

	mintService.setPhaseTimes(body);

	return c.json({ success: true, times: body });
});

// Export all data
app.get("/admin/export", adminAuth, (c) => {
	const data = mintService.exportData();
	return c.json(data);
});

// ==================
// BlindBox Metadata (Mystery Box)
// ==================
app.get("/blindbox/metadata/:tokenId", (c) => {
	const tokenId = c.req.param("tokenId");

	return c.json({
		name: `Mystery Box #${tokenId}`,
		description:
			"A mysterious box containing a LilStar NFT. Redeem to reveal your unique character!",
		image:
			"https://mint.lilstars.xyz/blindbox.png",
		animation_url:
			"https://mint.lilstars.xyz/blindbox-mint.mp4",
		external_url: "https://lilstars.xyz",
		attributes: [
			{
				trait_type: "Type",
				value: "Mystery Box",
			},
			{
				trait_type: "Status",
				value: "Unrevealed",
			},
		],
	});
});

// ==================
// LilStar Metadata (Revealed NFT)
// ==================
app.get("/lilstar/metadata/:tokenId", async (c) => {
	const tokenId = c.req.param("tokenId");

	// TODO: In production, fetch actual traits from database/chain
	// For now, generate deterministic traits based on tokenId as seed
	const seed = Number(tokenId);

	const db = await getTraitDb();
	const rng = new SeededRandom(seed);

	// Determine character and rarity based on seed
	const characters = COLLECTION_CONFIG.characters;
	const character = characters[seed % characters.length] as CharacterType;
	const rarity: Rarity = seed % 100 < 5 ? "legendary" : "common"; // 5% legendary

	const selection = selectTraitsForNFT(db, character, rarity, rng);

	const attributes = [];
	attributes.push({ trait_type: "Character", value: character });
	attributes.push({ trait_type: "Rarity", value: rarity });

	for (const [layer, trait] of selection.traits) {
		if (trait) {
			attributes.push({ trait_type: layer, value: trait.name });
		}
	}

	return c.json({
		name: `LilStar #${tokenId}`,
		description: `A unique LilStar character. ${rarity === "legendary" ? "This is a LEGENDARY edition!" : ""}`,
		image: `https://api.lilstars.xyz/lilstar/image/${tokenId}`,
		external_url: "https://lilstars.xyz",
		attributes,
	});
});

// Generate LilStar image on-the-fly
app.get("/lilstar/image/:tokenId", async (c) => {
	const tokenId = Number(c.req.param("tokenId"));
	const seed = tokenId;

	const db = await getTraitDb();
	const rng = new SeededRandom(seed);

	const characters = COLLECTION_CONFIG.characters;
	const character = characters[seed % characters.length] as CharacterType;
	const rarity: Rarity = seed % 100 < 5 ? "legendary" : "common";

	const selection = selectTraitsForNFT(db, character, rarity, rng);

	try {
		const imageBuffer = await generatePreview(selection);

		c.header("Content-Type", "image/png");
		c.header("Cache-Control", "public, max-age=31536000");

		return c.body(imageBuffer);
	} catch (err) {
		console.error(`Failed to generate LilStar image for token ${tokenId}:`, err);
		return c.json({ error: "Failed to generate image" }, 500);
	}
});

// ==================
// SBT Metadata (Soulbound Utility Tokens)
// ==================
const SBT_METADATA: Record<string, {
	name: string;
	description: string;
	image: string;
	attributes: Array<{ trait_type: string; value: string }>;
}> = {
	"1": {
		name: "5% Lifetime Discount",
		description: "This Soulbound Token grants you 5% lifetime discount on all IRL BlindBox purchases. Burn this token on our website to redeem your perk.",
		image: "https://static4.depositphotos.com/1012407/370/v/450/depositphotos_3707681-stock-illustration-yellow-ticket.jpg",
		attributes: [
			{ trait_type: "Type", value: "Discount" },
			{ trait_type: "Discount Rate", value: "5%" },
			{ trait_type: "Duration", value: "Lifetime" },
			{ trait_type: "Redeemable", value: "Yes" },
		],
	},
	"2": {
		name: "10% Lifetime Discount",
		description: "This Soulbound Token grants you 10% lifetime discount on all IRL BlindBox purchases. Burn this token on our website to redeem your perk.",
		image: "https://unitedpeople.global/wp-content/uploads/2021/12/raffle-ticket-blue-600x428.jpg",
		attributes: [
			{ trait_type: "Type", value: "Discount" },
			{ trait_type: "Discount Rate", value: "10%" },
			{ trait_type: "Duration", value: "Lifetime" },
			{ trait_type: "Redeemable", value: "Yes" },
		],
	},
	"3": {
		name: "Free IRL BlindBox",
		description: "This Soulbound Token grants you ONE free IRL BlindBox! Burn this token on our website to redeem your free box.",
		image: "https://flagster.in/cdn/shop/files/ed-mystery-box-red.png?v=1704102519",
		attributes: [
			{ trait_type: "Type", value: "Free Item" },
			{ trait_type: "Item", value: "IRL BlindBox" },
			{ trait_type: "Quantity", value: "1" },
			{ trait_type: "Redeemable", value: "Yes" },
		],
	},
};

app.get("/sbt/metadata/:tokenId", (c) => {
	const tokenId = c.req.param("tokenId");

	const metadata = SBT_METADATA[tokenId];
	if (!metadata) {
		return c.json({ error: "Invalid SBT token ID. Valid IDs: 1, 2, 3" }, 404);
	}

	return c.json({
		name: metadata.name,
		description: metadata.description,
		image: metadata.image,
		external_url: "https://lilstars.xyz/redeem",
		attributes: metadata.attributes,
	});
});

// ==================
// Generator endpoints
// ==================
let traitDb: Awaited<ReturnType<typeof loadTraitDatabase>> | null = null;

async function getTraitDb() {
	if (!traitDb) {
		traitDb = await loadTraitDatabase();
	}
	return traitDb;
}

// Preview a random NFT
app.get("/generate/preview", async (c) => {
	const character = (c.req.query("character") as CharacterType) || "bear";
	const rarity = (c.req.query("rarity") as Rarity) || "common";
	const seed = Number(c.req.query("seed")) || Date.now();

	if (!COLLECTION_CONFIG.characters.includes(character)) {
		return c.json({ error: "Invalid character type" }, 400);
	}

	if (rarity !== "legendary" && rarity !== "common") {
		return c.json({ error: "Invalid rarity type" }, 400);
	}

	const db = await getTraitDb();
	const rng = new SeededRandom(seed);
	const selection = selectTraitsForNFT(db, character, rarity, rng);

	const imageBuffer = await generatePreview(selection);

	c.header("Content-Type", "image/png");
	c.header("X-Seed", seed.toString());
	c.header("X-Character", character);
	c.header("X-Rarity", rarity);

	return c.body(imageBuffer);
});

// Get trait info for a preview
app.get("/generate/traits", async (c) => {
	const character = (c.req.query("character") as CharacterType) || "bear";
	const rarity = (c.req.query("rarity") as Rarity) || "common";
	const seed = Number(c.req.query("seed")) || Date.now();

	if (!COLLECTION_CONFIG.characters.includes(character)) {
		return c.json({ error: "Invalid character type" }, 400);
	}

	if (rarity !== "legendary" && rarity !== "common") {
		return c.json({ error: "Invalid rarity type" }, 400);
	}

	const db = await getTraitDb();
	const rng = new SeededRandom(seed);
	const selection = selectTraitsForNFT(db, character, rarity, rng);

	const traits: Record<string, string | null> = {};
	for (const [layer, trait] of selection.traits) {
		traits[layer] = trait ? trait.name : null;
	}

	return c.json({
		character,
		rarity,
		seed,
		traits,
	});
});

// Get collection config
app.get("/generate/config", (c) => {
	return c.json(COLLECTION_CONFIG);
});

// Serve generated images and metadata
app.use("/output/*", serveStatic({ root: "./" }));

// Serve metadata by token ID
app.get("/metadata/:tokenId", async (c) => {
	const tokenId = c.req.param("tokenId");
	const file = Bun.file(`./output/metadata/${tokenId}.json`);

	if (!(await file.exists())) {
		return c.json({ error: "Token not found" }, 404);
	}

	const metadata = await file.json();
	return c.json(metadata);
});

// Cache for collection data
let collectionCache: Array<{
	tokenId: number;
	character: string;
	rarity: string;
	traits: Array<{
		layer: string;
		name: string;
		filename: string;
		rarity: string;
	}>;
}> | null = null;

async function getCollection() {
	if (!collectionCache) {
		const file = Bun.file("./output/collection.json");
		if (await file.exists()) {
			collectionCache = await file.json();
		}
	}
	return collectionCache;
}

// Generate image on-the-fly from stored metadata
app.get("/generate/image/:tokenId", async (c) => {
	const tokenId = Number(c.req.param("tokenId"));

	const collection = await getCollection();
	if (!collection) {
		return c.json({ error: "Collection not found" }, 404);
	}

	const metadata = collection.find((m) => m.tokenId === tokenId);
	if (!metadata) {
		return c.json({ error: "Token not found" }, 404);
	}

	// Reconstruct SelectedTraits from stored metadata
	const traitsMap = new Map<LayerType, TraitMetadata | null>();

	for (const trait of metadata.traits || []) {
		traitsMap.set(trait.layer as LayerType, {
			layer: trait.layer as LayerType,
			name: trait.name,
			filename: trait.filename,
			rarity: trait.rarity as Rarity,
		});
	}

	const selection = {
		character: metadata.character as CharacterType,
		rarity: metadata.rarity as Rarity,
		traits: traitsMap,
	};

	try {
		const imageBuffer = await generatePreview(selection);

		c.header("Content-Type", "image/png");
		c.header("X-TokenId", tokenId.toString());
		c.header("X-Character", metadata.character);
		c.header("X-Rarity", metadata.rarity);
		c.header("Cache-Control", "public, max-age=31536000"); // Cache for 1 year

		return c.body(imageBuffer);
	} catch (err) {
		console.error(`Failed to generate image for token ${tokenId}:`, err);
		return c.json({ error: "Failed to generate image" }, 500);
	}
});

const port = Number(process.env.PORT) || 3000;

export default {
	port,
	fetch: app.fetch,
};
