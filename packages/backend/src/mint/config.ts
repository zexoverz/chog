// Mint configuration based on mint-plan.md

export const MINT_CONFIG = {
  // Total supply
  TOTAL_SUPPLY: 6000,

  // Non-mintable / Reserved supply
  PRESALE_ALLOCATION: 1800,    // Reserved for presale investors
  MINTHUB_COMPANY: 222,
  TEAM: 222,
  TOTAL_RESERVED: 2244,        // 1800 + 222 + 222

  // Mintable supply
  TOTAL_MINTABLE: 3756,        // 6000 - 2244

  // Pricing (in USD, converted to native token at mint time)
  PRICES: {
    PRESALE: 25,               // $25 per NFT (non-mintable, reserved)
    STARLIST: 35,              // $35 per NFT (Whitelist)
    FCFS: 40,                  // $40 per NFT (Public)
  },

  // Per-address limits
  MAX_PER_ADDRESS_STARLIST: 5,
  MAX_PER_ADDRESS_FCFS: 3,

  // Phases
  PHASES: {
    NOT_STARTED: 'not_started',
    STARLIST: 'starlist',      // Whitelist phase
    FCFS: 'fcfs',              // Public phase
    ENDED: 'ended',
  } as const,
} as const;

export type MintPhase = typeof MINT_CONFIG.PHASES[keyof typeof MINT_CONFIG.PHASES];
