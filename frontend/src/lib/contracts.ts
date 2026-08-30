import { type Address } from "viem";

// Populated after Sepolia deployment (Phase 0 deploy step, currently pending).
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "") as Address;
export const FAKE_USDC_ADDRESS = (process.env
  .NEXT_PUBLIC_FAKE_USDC_ADDRESS ?? "") as Address;
