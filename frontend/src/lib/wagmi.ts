import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

const anvilRpcUrl =
  process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? "http://127.0.0.1:8545";

const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [anvilRpcUrl] },
  },
});

// WalletConnect project id is required by RainbowKit even if only the
// injected/MetaMask connector is used in practice. Get one at https://cloud.reown.com
// and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID before shipping to production —
// the placeholder below only satisfies RainbowKit's build-time check.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName: "Mini Pump",
  projectId: walletConnectProjectId,
  chains: [anvil],
  ssr: true,
});
