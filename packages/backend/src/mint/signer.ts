import {
  type Address,
  type Hex,
  encodePacked,
  keccak256,
  toBytes,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount, signMessage } from "viem/accounts";

export interface MintSignerConfig {
  privateKey: Hex;
}

export interface PresaleSignature {
  amount: number;
  maxAllowed: number;
  address: Address;
  signature: Hex;
}

export interface FcfsSignature {
  address: Address;
  signature: Hex;
}

/**
 * MintSigner generates signatures for BlindBox contract minting
 *
 * The BlindBox contract uses ECDSA signatures to verify mint eligibility:
 * - Presale/Starlist: keccak256(abi.encodePacked(amount, msg.sender, maxAllowedForPresaleForAddr))
 * - FCFS/Auction: keccak256(abi.encodePacked(msg.sender))
 */
export class BlindBoxMintSigner {
  private account: PrivateKeyAccount;

  constructor(config: MintSignerConfig) {
    this.account = privateKeyToAccount(config.privateKey);
  }

  get signerAddress(): Address {
    return this.account.address;
  }

  /**
   * Sign a presale/starlist mint request
   * Contract verifies: keccak256(abi.encodePacked(amount, msg.sender, maxAllowedForPresaleForAddr))
   */
  async signPresaleMint(
    minterAddress: Address,
    amount: number,
    maxAllowed: number
  ): Promise<PresaleSignature> {
    // Match contract's abi.encodePacked(amount, msg.sender, maxAllowedForPresaleForAddr)
    // amount and maxAllowed are uint16 in the contract
    const messageHash = keccak256(
      encodePacked(
        ["uint16", "address", "uint16"],
        [amount, minterAddress, maxAllowed]
      )
    );

    // Sign with EIP-191 prefix (toEthSignedMessageHash equivalent)
    const signature = await this.account.signMessage({
      message: { raw: toBytes(messageHash) },
    });

    return {
      amount,
      maxAllowed,
      address: minterAddress,
      signature,
    };
  }

  /**
   * Sign a FCFS/auction mint request
   * Contract verifies: keccak256(abi.encodePacked(msg.sender))
   */
  async signFcfsMint(minterAddress: Address): Promise<FcfsSignature> {
    // Match contract's abi.encodePacked(msg.sender)
    const messageHash = keccak256(
      encodePacked(["address"], [minterAddress])
    );

    // Sign with EIP-191 prefix (toEthSignedMessageHash equivalent)
    const signature = await this.account.signMessage({
      message: { raw: toBytes(messageHash) },
    });

    return {
      address: minterAddress,
      signature,
    };
  }
}
