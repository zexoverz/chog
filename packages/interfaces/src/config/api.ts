export const API_BASE_URL = "http://localhost:3001";

export interface MintPermitRequest {
  to: string;
  tokenId: string;
}

export interface MintPermitResponse {
  to: string;
  tokenId: string;
  nonce: string;
  deadline: string;
  signature: `0x${string}`;
}

export interface ApiInfoResponse {
  name: string;
  signer: string;
}

export async function getApiInfo(): Promise<ApiInfoResponse> {
  const res = await fetch(`${API_BASE_URL}/`);
  if (!res.ok) throw new Error("Failed to fetch API info");
  return res.json();
}

export async function requestMintPermit(
  to: string,
  tokenId: string
): Promise<MintPermitResponse> {
  const res = await fetch(`${API_BASE_URL}/mint/permit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, tokenId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Failed to get mint permit");
  }

  return res.json();
}
