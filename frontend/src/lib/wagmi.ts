import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

// WalletConnect project id is required by RainbowKit even if only the
// injected/MetaMask connector is used in practice. Get one at https://cloud.reown.com
// and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID before shipping to production —
// the placeholder below only satisfies RainbowKit's build-time check.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName: "Mini Pump",
  projectId: walletConnectProjectId,
  chains: [sepolia],
  ssr: true,
});
