import type { Address } from "viem";
import { getAddress } from "viem";
import { MINT_CONFIG } from "./config";

export interface WhitelistEntry {
  address: Address;
  maxAllocation: number;
  mintedCount: number;
  addedAt: number;
}

export interface FcfsEntry {
  address: Address;
  mintedCount: number;
}

/**
 * WhitelistManager handles starlist (whitelist) and FCFS eligibility
 *
 * In production, this should be backed by a database.
 * For now, uses in-memory storage with optional file persistence.
 */
export class WhitelistManager {
  private starlist: Map<Address, WhitelistEntry> = new Map();
  private fcfsMinted: Map<Address, FcfsEntry> = new Map();
  private dataFile: string;

  constructor(dataFile: string = "./data/whitelist.json") {
    this.dataFile = dataFile;
    this.loadFromFile();
  }

  // ==================
  // Starlist Management
  // ==================

  /**
   * Add address to starlist with allocation
   */
  addToStarlist(address: Address, maxAllocation: number = MINT_CONFIG.MAX_PER_ADDRESS_STARLIST): void {
    const normalizedAddress = getAddress(address);

    if (this.starlist.has(normalizedAddress)) {
      // Update existing entry
      const entry = this.starlist.get(normalizedAddress)!;
      entry.maxAllocation = maxAllocation;
    } else {
      this.starlist.set(normalizedAddress, {
        address: normalizedAddress,
        maxAllocation,
        mintedCount: 0,
        addedAt: Date.now(),
      });
    }

    this.saveToFile();
  }

  /**
   * Add multiple addresses to starlist
   */
  addBulkToStarlist(addresses: Address[], maxAllocation: number = MINT_CONFIG.MAX_PER_ADDRESS_STARLIST): void {
    for (const address of addresses) {
      this.addToStarlist(address, maxAllocation);
    }
  }

  /**
   * Remove address from starlist
   */
  removeFromStarlist(address: Address): boolean {
    const normalizedAddress = getAddress(address);
    const result = this.starlist.delete(normalizedAddress);
    this.saveToFile();
    return result;
  }

  /**
   * Check if address is on starlist
   */
  isOnStarlist(address: Address): boolean {
    const normalizedAddress = getAddress(address);
    return this.starlist.has(normalizedAddress);
  }

  /**
   * Get starlist entry for address
   */
  getStarlistEntry(address: Address): WhitelistEntry | null {
    const normalizedAddress = getAddress(address);
    return this.starlist.get(normalizedAddress) || null;
  }

  /**
   * Get remaining allocation for address
   */
  getStarlistRemaining(address: Address): number {
    const entry = this.getStarlistEntry(address);
    if (!entry) return 0;
    return Math.max(0, entry.maxAllocation - entry.mintedCount);
  }

  /**
   * Record a starlist mint
   */
  recordStarlistMint(address: Address, amount: number): boolean {
    const normalizedAddress = getAddress(address);
    const entry = this.starlist.get(normalizedAddress);

    if (!entry) return false;
    if (entry.mintedCount + amount > entry.maxAllocation) return false;

    entry.mintedCount += amount;
    this.saveToFile();
    return true;
  }

  /**
   * Get all starlist entries
   */
  getAllStarlist(): WhitelistEntry[] {
    return Array.from(this.starlist.values());
  }

  /**
   * Get starlist count
   */
  getStarlistCount(): number {
    return this.starlist.size;
  }

  // ==================
  // FCFS Management
  // ==================

  /**
   * Get FCFS minted count for address
   */
  getFcfsMintedCount(address: Address): number {
    const normalizedAddress = getAddress(address);
    const entry = this.fcfsMinted.get(normalizedAddress);
    return entry?.mintedCount || 0;
  }

  /**
   * Get FCFS remaining for address
   */
  getFcfsRemaining(address: Address): number {
    const minted = this.getFcfsMintedCount(address);
    return Math.max(0, MINT_CONFIG.MAX_PER_ADDRESS_FCFS - minted);
  }

  /**
   * Check if address can mint in FCFS
   */
  canMintFcfs(address: Address, amount: number = 1): boolean {
    return this.getFcfsRemaining(address) >= amount;
  }

  /**
   * Record a FCFS mint
   */
  recordFcfsMint(address: Address, amount: number): boolean {
    const normalizedAddress = getAddress(address);

    if (!this.canMintFcfs(normalizedAddress, amount)) return false;

    const entry = this.fcfsMinted.get(normalizedAddress);
    if (entry) {
      entry.mintedCount += amount;
    } else {
      this.fcfsMinted.set(normalizedAddress, {
        address: normalizedAddress,
        mintedCount: amount,
      });
    }

    this.saveToFile();
    return true;
  }

  // ==================
  // Persistence
  // ==================

  private async loadFromFile(): Promise<void> {
    try {
      const file = Bun.file(this.dataFile);
      if (await file.exists()) {
        const data = await file.json();

        if (data.starlist) {
          this.starlist = new Map(
            data.starlist.map((entry: WhitelistEntry) => [
              getAddress(entry.address),
              { ...entry, address: getAddress(entry.address) },
            ])
          );
        }

        if (data.fcfsMinted) {
          this.fcfsMinted = new Map(
            data.fcfsMinted.map((entry: FcfsEntry) => [
              getAddress(entry.address),
              { ...entry, address: getAddress(entry.address) },
            ])
          );
        }
      }
    } catch (error) {
      console.error("Failed to load whitelist data:", error);
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      const data = {
        starlist: Array.from(this.starlist.values()),
        fcfsMinted: Array.from(this.fcfsMinted.values()),
        updatedAt: new Date().toISOString(),
      };

      await Bun.write(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save whitelist data:", error);
    }
  }

  /**
   * Export whitelist data
   */
  export(): { starlist: WhitelistEntry[]; fcfsMinted: FcfsEntry[] } {
    return {
      starlist: Array.from(this.starlist.values()),
      fcfsMinted: Array.from(this.fcfsMinted.values()),
    };
  }

  /**
   * Import whitelist data
   */
  import(data: { starlist?: WhitelistEntry[]; fcfsMinted?: FcfsEntry[] }): void {
    if (data.starlist) {
      for (const entry of data.starlist) {
        this.starlist.set(getAddress(entry.address), {
          ...entry,
          address: getAddress(entry.address),
        });
      }
    }

    if (data.fcfsMinted) {
      for (const entry of data.fcfsMinted) {
        this.fcfsMinted.set(getAddress(entry.address), {
          ...entry,
          address: getAddress(entry.address),
        });
      }
    }

    this.saveToFile();
  }

  /**
   * Clear all data (use with caution!)
   */
  clear(): void {
    this.starlist.clear();
    this.fcfsMinted.clear();
    this.saveToFile();
  }
}
