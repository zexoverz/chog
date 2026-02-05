import {
	type Address,
	encodePacked,
	type Hex,
	keccak256,
	type PrivateKeyAccount,
	toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface MintSignerConfig {
	privateKey: Hex;
}

export interface MintSignature {
	maxAllowed: number;
	phase: string;
	address: Address;
	signature: Hex;
}

/**
 * MintSigner generates signatures for BlindBox contract minting
 *
 * The BlindBox contract uses ECDSA signatures to verify mint eligibility:
 * - _verifySignature: keccak256(abi.encodePacked(address minter, uint16 maxAllowed, string phase))
 * - presaleMint verifies with phase = "PRESALE"
 * - starlistMint verifies with phase = "STARLIST"
 * - fcfsMint does NOT require a signature
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
	 * Sign a mint request matching the contract's _verifySignature
	 * Contract verifies: keccak256(abi.encodePacked(address minter, uint16 maxAllowed, string phase))
	 *
	 * @param minterAddress - The wallet address minting
	 * @param maxAllowed - Max allocation for the address (uint16)
	 * @param phase - Contract phase string: "PRESALE" or "STARLIST"
	 */
	async signMint(
		minterAddress: Address,
		maxAllowed: number,
		phase: string,
	): Promise<MintSignature> {
		const messageHash = keccak256(
			encodePacked(
				["address", "uint16", "string"],
				[minterAddress, maxAllowed, phase],
			),
		);

		// Sign with EIP-191 prefix (toEthSignedMessageHash equivalent)
		const signature = await this.account.signMessage({
			message: { raw: toBytes(messageHash) },
		});

		return {
			maxAllowed,
			phase,
			address: minterAddress,
			signature,
		};
	}
}
