import type { Address, Hex, PrivateKeyAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const MINT_TYPES = {
	Mint: [
		{ name: "to", type: "address" },
		{ name: "tokenId", type: "uint256" },
		{ name: "nonce", type: "uint256" },
		{ name: "deadline", type: "uint256" },
	],
} as const;

export interface MintPermit {
	to: Address;
	tokenId: bigint;
	nonce: bigint;
	deadline: bigint;
	signature: Hex;
}

export interface SignerConfig {
	privateKey: Hex;
	contractAddress: Address;
	contractName: string;
	chainId: number;
}

export class MintSigner {
	private account: PrivateKeyAccount;
	private contractAddress: Address;
	private contractName: string;
	private chainId: number;
	private nonceCounter: bigint = 0n;

	constructor(config: SignerConfig) {
		this.account = privateKeyToAccount(config.privateKey);
		this.contractAddress = config.contractAddress;
		this.contractName = config.contractName;
		this.chainId = config.chainId;
	}

	get signerAddress(): Address {
		return this.account.address;
	}

	private getNextNonce(): bigint {
		return ++this.nonceCounter;
	}

	async signMintPermit(
		to: Address,
		tokenId: bigint,
		deadlineSeconds: number = 3600,
	): Promise<MintPermit> {
		const nonce = this.getNextNonce();
		const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

		const domain = {
			name: this.contractName,
			version: "1",
			chainId: this.chainId,
			verifyingContract: this.contractAddress,
		};

		const message = {
			to,
			tokenId,
			nonce,
			deadline,
		};

		const signature = await this.account.signTypedData({
			domain,
			types: MINT_TYPES,
			primaryType: "Mint",
			message,
		});

		return {
			to,
			tokenId,
			nonce,
			deadline,
			signature,
		};
	}
}
