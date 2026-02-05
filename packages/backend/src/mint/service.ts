import type { Address, Hex } from "viem";
import { createPublicClient, getAddress, http } from "viem";
import { monadTestnet } from "viem/chains";
import { MINT_CONFIG, type MintPhase } from "./config";
import { BlindBoxMintSigner } from "./signer";
import { WhitelistManager } from "./whitelist";

// BlindBox contract ABI (only currentPhase needed)
const blindBoxPhaseAbi = [
	{
		inputs: [],
		name: "currentPhase",
		outputs: [
			{ internalType: "enum BlindBox.MintPhase", name: "", type: "uint8" },
		],
		stateMutability: "view",
		type: "function",
	},
] as const;

// On-chain phase enum: 0=CLOSED, 1=PRESALE, 2=STARLIST, 3=FCFS
// Backend mapping:
//   Contract PRESALE (1) → backend "starlist" (uses presaleMint on-chain)
//   Contract STARLIST (2) → backend "fcfs" (uses starlistMint on-chain)
//   Contract FCFS (3) → no signature needed
const ONCHAIN_PHASE_MAP: Record<number, MintPhase> = {
	0: MINT_CONFIG.PHASES.NOT_STARTED,
	1: MINT_CONFIG.PHASES.STARLIST,
	2: MINT_CONFIG.PHASES.FCFS,
	3: MINT_CONFIG.PHASES.ENDED, // FCFS on-chain needs no sig, treat as ended for backend
};

export interface MintStatus {
	phase: MintPhase;
	totalSupply: number;
	totalMintable: number;
	starlistPrice: number;
	fcfsPrice: number;
	maxPerAddressStarlist: number;
	maxPerAddressFcfs: number;
}

export interface EligibilityResult {
	eligible: boolean;
	phase: MintPhase;
	reason?: string;
	maxAllowed?: number;
	remaining?: number;
	price?: number;
}

export interface SignatureResult {
	success: boolean;
	signature?: Hex;
	maxAllowed?: number;
	contractPhase?: string;
	price?: number;
	error?: string;
}

export interface MintServiceConfig {
	signerPrivateKey: Hex;
	blindBoxAddress: Address;
	adminAddresses?: Address[];
	phaseOverride?: MintPhase;
	starlistStartTime?: number;
	starlistEndTime?: number;
	fcfsStartTime?: number;
	fcfsEndTime?: number;
}

/**
 * MintService coordinates the mint process
 *
 * Handles:
 * - Phase management (Starlist -> FCFS)
 * - Eligibility checking
 * - Signature generation
 * - Whitelist management
 */
export class MintService {
	private signer: BlindBoxMintSigner;
	private whitelist: WhitelistManager;
	private adminAddresses: Set<Address>;
	private phaseOverride?: MintPhase;
	private starlistStartTime: number;
	private starlistEndTime: number;
	private fcfsStartTime: number;
	private fcfsEndTime: number;
	private blindBoxAddress: Address;
	private publicClient: ReturnType<typeof createPublicClient>;
	private cachedPhase: MintPhase = MINT_CONFIG.PHASES.NOT_STARTED;
	private lastPhaseFetch = 0;

	constructor(config: MintServiceConfig) {
		this.signer = new BlindBoxMintSigner({
			privateKey: config.signerPrivateKey,
		});

		this.whitelist = new WhitelistManager();

		this.adminAddresses = new Set(
			(config.adminAddresses || []).map((a) => getAddress(a)),
		);

		this.phaseOverride = config.phaseOverride;

		// Default times (should be configured via environment or admin)
		this.starlistStartTime = config.starlistStartTime || 0;
		this.starlistEndTime = config.starlistEndTime || 0;
		this.fcfsStartTime = config.fcfsStartTime || 0;
		this.fcfsEndTime = config.fcfsEndTime || 0;

		this.blindBoxAddress = config.blindBoxAddress;
		this.publicClient = createPublicClient({
			chain: monadTestnet,
			transport: http(),
		});

		// Fetch phase immediately on start
		this.fetchOnChainPhase();
	}

	get signerAddress(): Address {
		return this.signer.signerAddress;
	}

	// ==================
	// Phase Management
	// ==================

	/**
	 * Fetch current phase from on-chain contract
	 */
	private async fetchOnChainPhase(): Promise<void> {
		try {
			const phase = await this.publicClient.readContract({
				address: this.blindBoxAddress,
				abi: blindBoxPhaseAbi,
				functionName: "currentPhase",
			});
			this.cachedPhase =
				ONCHAIN_PHASE_MAP[phase as number] ?? MINT_CONFIG.PHASES.NOT_STARTED;
			this.lastPhaseFetch = Date.now();
			console.log(`[MintService] On-chain phase: ${phase} → ${this.cachedPhase}`);
		} catch (err) {
			console.error("[MintService] Failed to fetch on-chain phase:", err);
		}
	}

	/**
	 * Get current mint phase from on-chain contract (cached for 10s)
	 */
	getCurrentPhase(): MintPhase {
		if (this.phaseOverride) {
			return this.phaseOverride;
		}

		// Refresh cache in background if stale (>10s)
		if (Date.now() - this.lastPhaseFetch > 10_000) {
			this.fetchOnChainPhase();
		}

		return this.cachedPhase;
	}

	/**
	 * Set phase override (admin only)
	 */
	setPhaseOverride(phase: MintPhase | null): void {
		this.phaseOverride = phase || undefined;
	}

	/**
	 * Set phase times (admin only)
	 */
	setPhaseTimes(times: {
		starlistStart?: number;
		starlistEnd?: number;
		fcfsStart?: number;
		fcfsEnd?: number;
	}): void {
		if (times.starlistStart !== undefined)
			this.starlistStartTime = times.starlistStart;
		if (times.starlistEnd !== undefined)
			this.starlistEndTime = times.starlistEnd;
		if (times.fcfsStart !== undefined) this.fcfsStartTime = times.fcfsStart;
		if (times.fcfsEnd !== undefined) this.fcfsEndTime = times.fcfsEnd;
	}

	/**
	 * Get mint status
	 */
	getStatus(): MintStatus {
		return {
			phase: this.getCurrentPhase(),
			totalSupply: MINT_CONFIG.TOTAL_SUPPLY,
			totalMintable: MINT_CONFIG.TOTAL_MINTABLE,
			starlistPrice: MINT_CONFIG.PRICES.STARLIST,
			fcfsPrice: MINT_CONFIG.PRICES.FCFS,
			maxPerAddressStarlist: MINT_CONFIG.MAX_PER_ADDRESS_STARLIST,
			maxPerAddressFcfs: MINT_CONFIG.MAX_PER_ADDRESS_FCFS,
		};
	}

	// ==================
	// Eligibility
	// ==================

	/**
	 * Check mint eligibility for an address
	 */
	checkEligibility(address: Address): EligibilityResult {
		const normalizedAddress = getAddress(address);
		const phase = this.getCurrentPhase();

		if (phase === MINT_CONFIG.PHASES.NOT_STARTED) {
			return {
				eligible: false,
				phase,
				reason: "Mint has not started yet",
			};
		}

		if (phase === MINT_CONFIG.PHASES.ENDED) {
			return {
				eligible: false,
				phase,
				reason: "Mint has ended",
			};
		}

		if (phase === MINT_CONFIG.PHASES.STARLIST) {
			const entry = this.whitelist.getStarlistEntry(normalizedAddress);

			if (!entry) {
				return {
					eligible: false,
					phase,
					reason: "Address not on starlist",
				};
			}

			const remaining = this.whitelist.getStarlistRemaining(normalizedAddress);

			if (remaining <= 0) {
				return {
					eligible: false,
					phase,
					reason: "Starlist allocation exhausted",
					maxAllowed: entry.maxAllocation,
					remaining: 0,
				};
			}

			return {
				eligible: true,
				phase,
				maxAllowed: entry.maxAllocation,
				remaining,
				price: MINT_CONFIG.PRICES.STARLIST,
			};
		}

		if (phase === MINT_CONFIG.PHASES.FCFS) {
			const remaining = this.whitelist.getFcfsRemaining(normalizedAddress);

			if (remaining <= 0) {
				return {
					eligible: false,
					phase,
					reason: "FCFS allocation exhausted",
					maxAllowed: MINT_CONFIG.MAX_PER_ADDRESS_FCFS,
					remaining: 0,
				};
			}

			return {
				eligible: true,
				phase,
				maxAllowed: MINT_CONFIG.MAX_PER_ADDRESS_FCFS,
				remaining,
				price: MINT_CONFIG.PRICES.FCFS,
			};
		}

		return {
			eligible: false,
			phase,
			reason: "Unknown phase",
		};
	}

	// ==================
	// Signature Generation
	// ==================

	/**
	 * Generate mint signature for an address
	 *
	 * Phase mapping (backend phase → contract phase string):
	 * - Backend STARLIST → contract "PRESALE" (uses presaleMint on-chain)
	 * - Backend FCFS → contract "STARLIST" (uses starlistMint on-chain)
	 *
	 * Contract's fcfsMint does not require a signature.
	 */
	async generateSignature(
		address: Address,
		amount: number,
	): Promise<SignatureResult> {
		const normalizedAddress = getAddress(address);
		const eligibility = this.checkEligibility(normalizedAddress);

		if (!eligibility.eligible) {
			return {
				success: false,
				error: eligibility.reason,
			};
		}

		if (amount <= 0) {
			return {
				success: false,
				error: "Amount must be greater than 0",
			};
		}

		if (amount > (eligibility.remaining || 0)) {
			return {
				success: false,
				error: `Amount exceeds remaining allocation (${eligibility.remaining})`,
			};
		}

		const phase = this.getCurrentPhase();

		if (phase === MINT_CONFIG.PHASES.STARLIST) {
			const entry = this.whitelist.getStarlistEntry(normalizedAddress);
			if (!entry) {
				return {
					success: false,
					error: "Address not on starlist",
				};
			}

			// Backend STARLIST → contract presaleMint → phase string "PRESALE"
			const result = await this.signer.signMint(
				normalizedAddress,
				entry.maxAllocation,
				"PRESALE",
			);

			return {
				success: true,
				signature: result.signature,
				maxAllowed: entry.maxAllocation,
				contractPhase: "PRESALE",
				price: MINT_CONFIG.PRICES.STARLIST,
			};
		}

		if (phase === MINT_CONFIG.PHASES.FCFS) {
			// Backend FCFS → contract starlistMint → phase string "STARLIST"
			const result = await this.signer.signMint(
				normalizedAddress,
				MINT_CONFIG.MAX_PER_ADDRESS_FCFS,
				"STARLIST",
			);

			return {
				success: true,
				signature: result.signature,
				maxAllowed: MINT_CONFIG.MAX_PER_ADDRESS_FCFS,
				contractPhase: "STARLIST",
				price: MINT_CONFIG.PRICES.FCFS,
			};
		}

		return {
			success: false,
			error: "Cannot generate signature for current phase",
		};
	}

	/**
	 * Record a successful mint (called after on-chain confirmation)
	 */
	recordMint(address: Address, amount: number): boolean {
		const normalizedAddress = getAddress(address);
		const phase = this.getCurrentPhase();

		if (phase === MINT_CONFIG.PHASES.STARLIST) {
			return this.whitelist.recordStarlistMint(normalizedAddress, amount);
		}

		if (phase === MINT_CONFIG.PHASES.FCFS) {
			return this.whitelist.recordFcfsMint(normalizedAddress, amount);
		}

		return false;
	}

	// ==================
	// Admin Functions
	// ==================

	/**
	 * Check if address is admin
	 */
	isAdmin(address: Address): boolean {
		return this.adminAddresses.has(getAddress(address));
	}

	/**
	 * Add address to starlist
	 */
	addToStarlist(address: Address, maxAllocation?: number): void {
		this.whitelist.addToStarlist(address, maxAllocation);
	}

	/**
	 * Add multiple addresses to starlist
	 */
	addBulkToStarlist(addresses: Address[], maxAllocation?: number): void {
		this.whitelist.addBulkToStarlist(addresses, maxAllocation);
	}

	/**
	 * Remove address from starlist
	 */
	removeFromStarlist(address: Address): boolean {
		return this.whitelist.removeFromStarlist(address);
	}

	/**
	 * Get starlist info
	 */
	getStarlistInfo(): {
		count: number;
		entries: Array<{
			address: Address;
			maxAllocation: number;
			mintedCount: number;
			remaining: number;
		}>;
	} {
		const entries = this.whitelist.getAllStarlist().map((entry) => ({
			address: entry.address,
			maxAllocation: entry.maxAllocation,
			mintedCount: entry.mintedCount,
			remaining: entry.maxAllocation - entry.mintedCount,
		}));

		return {
			count: entries.length,
			entries,
		};
	}

	/**
	 * Export all data
	 */
	exportData() {
		return {
			config: {
				phase: this.getCurrentPhase(),
				phaseOverride: this.phaseOverride,
				starlistStartTime: this.starlistStartTime,
				starlistEndTime: this.starlistEndTime,
				fcfsStartTime: this.fcfsStartTime,
				fcfsEndTime: this.fcfsEndTime,
			},
			whitelist: this.whitelist.export(),
		};
	}
}
