// Mint configuration based on mint-plan.md

export const MINT_CONFIG = {
	// Total supply (airdrop first while CLOSED, remaining available for public mint)
	TOTAL_SUPPLY: 6000,

	// Pricing (in USD, converted to native token at mint time)
	PRICES: {
		PRESALE: 25, // $25 per NFT (non-mintable, reserved)
		STARLIST: 35, // $35 per NFT (Whitelist)
		FCFS: 40, // $40 per NFT (Public)
	},

	// Per-address limits
	MAX_PER_ADDRESS_STARLIST: 5,
	MAX_PER_ADDRESS_FCFS: 3,

	// Phases
	PHASES: {
		NOT_STARTED: "not_started",
		STARLIST: "starlist", // Whitelist phase
		FCFS: "fcfs", // Public phase
		ENDED: "ended",
	} as const,
} as const;

export type MintPhase =
	(typeof MINT_CONFIG.PHASES)[keyof typeof MINT_CONFIG.PHASES];
