import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Coinbase Wallet connector (pulled in by RainbowKit's default wallet list)
  // depends on optional @x402/* packages that aren't installed. Marking the
  // SDK as an external server package prevents build-time resolution errors.
  serverExternalPackages: ["@coinbase/cdp-sdk"],
};

export default nextConfig;
