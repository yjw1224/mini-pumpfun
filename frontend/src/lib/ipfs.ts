const PINATA_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

export function toGatewayUrl(uri: string) {
  return uri.startsWith("ipfs://")
    ? `${PINATA_GATEWAY_URL}${uri.slice("ipfs://".length)}`
    : uri;
}