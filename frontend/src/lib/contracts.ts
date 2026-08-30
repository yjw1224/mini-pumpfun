import { type Address } from "viem";
import { factoryAbi } from "@/abi/factory";
import { bondingCurveAbi } from "@/abi/bondingCurve";
import { memeTokenAbi } from "@/abi/memeToken";

// Populated after Sepolia deployment (Phase 0 deploy step, currently pending).
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "") as Address;
export const FAKE_USDC_ADDRESS = (process.env
  .NEXT_PUBLIC_FAKE_USDC_ADDRESS ?? "") as Address;

// Block the Factory was deployed at — TokenCreated/TokenGraduated logs are
// only queried from here onward to keep getLogs calls bounded.
export const FACTORY_DEPLOY_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK ?? "0"
);

export { factoryAbi, bondingCurveAbi, memeTokenAbi };
