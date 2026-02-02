import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { type Address, isAddress, getAddress } from "viem";
import { MintSigner } from "./signer";
import {
  loadTraitDatabase,
  selectTraitsForNFT,
  SeededRandom,
  generatePreview,
  type CharacterType,
  type Rarity,
  type LayerType,
  type TraitMetadata,
  COLLECTION_CONFIG,
} from "./generator";
import {
  MintService,
  MINT_CONFIG,
  type MintPhase,
} from "./mint";

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
  signerPrivateKey: (process.env.MINT_SIGNER_PRIVATE_KEY as `0x${string}`) ||
    (process.env.SIGNER_PRIVATE_KEY as `0x${string}`) ||
    "0x0000000000000000000000000000000000000000000000000000000000000001",
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
    body.amount
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result);
});

// Record successful mint (webhook from frontend after on-chain confirmation)
app.post("/mint/record", async (c) => {
  const body = await c.req.json<{ address: string; amount: number; txHash?: string }>();

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
  const body = await c.req.json<{ addresses: string[]; maxAllocation?: number }>();

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
    description: "A mysterious box containing a LilStar NFT. Redeem to reveal your unique character!",
    image: "https://static.vecteezy.com/system/resources/thumbnails/006/847/476/small/mystery-gift-box-with-cardboard-box-open-inside-with-a-question-mark-lucky-gift-or-other-surprise-in-flat-cartoon-style-illustration-vector.jpg",
    external_url: "https://testnet-api.lilchogstars.com",
    attributes: [
      {
        trait_type: "Type",
        value: "Mystery Box"
      },
      {
        trait_type: "Status",
        value: "Unrevealed"
      }
    ]
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
  traits: Array<{ layer: string; name: string; filename: string; rarity: string }>;
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
