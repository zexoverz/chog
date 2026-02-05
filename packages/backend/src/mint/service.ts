import type { Address, Hex } from "viem";
import { getAddress } from "viem";
import { MINT_CONFIG, type MintPhase } from "./config";
import { BlindBoxMintSigner } from "./signer";
import { WhitelistManager } from "./whitelist";

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
	}

	get signerAddress(): Address {
		return this.signer.signerAddress;
	}

	// ==================
	// Phase Management
	// ==================

	/**
	 * Get current mint phase based on time
	 */
	getCurrentPhase(): MintPhase {
		if (this.phaseOverride) {
			return this.phaseOverride;
		}

		const now = Math.floor(Date.now() / 1000);

		if (
			this.starlistStartTime > 0 &&
			now >= this.starlistStartTime &&
			now < this.starlistEndTime
		) {
			return MINT_CONFIG.PHASES.STARLIST;
		}

		if (
			this.fcfsStartTime > 0 &&
			now >= this.fcfsStartTime &&
			now < this.fcfsEndTime
		) {
			return MINT_CONFIG.PHASES.FCFS;
		}

		if (this.fcfsEndTime > 0 && now >= this.fcfsEndTime) {
			return MINT_CONFIG.PHASES.ENDED;
		}

		return MINT_CONFIG.PHASES.NOT_STARTED;
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
