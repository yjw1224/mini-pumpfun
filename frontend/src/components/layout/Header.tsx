"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Droplets, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, isAddress } from "viem";
import { FAKE_USDC_ADDRESS, fakeUSDCAbi } from "@/lib/contracts";

const FAUCET_AMOUNT = 1_000_000n * 10n ** 18n;

export function Header() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  const hasFakeUsdc = isAddress(FAKE_USDC_ADDRESS);
  const isReady = isConnected && chainId === 31337 && hasFakeUsdc;
  const isLoading = isPending || isConfirming;
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: FAKE_USDC_ADDRESS,
    abi: fakeUSDCAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isReady },
  });

  useEffect(() => {
    if (isConfirmed) {
      void refetchUsdcBalance();
    }
  }, [isConfirmed, refetchUsdcBalance]);

  const formattedBalance = usdcBalance === undefined
    ? "-"
    : Number(formatUnits(usdcBalance, 18)).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });

  function handleFaucet() {
    if (!isReady) return;

    writeContract({
      chainId: 31337,
      address: FAKE_USDC_ADDRESS,
      abi: fakeUSDCAbi,
      functionName: "faucet",
      args: [FAUCET_AMOUNT],
    });
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-background px-6">
      {isConnected && (
        <span className="text-sm text-text-secondary">
          {formattedBalance} USDC
        </span>
      )}
      <button
        type="button"
        onClick={handleFaucet}
        disabled={!isReady || isLoading}
        title={
          hasFakeUsdc
            ? "100만 Test USDC 받기"
            : "NEXT_PUBLIC_FAKE_USDC_ADDRESS를 먼저 설정하세요"
        }
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong px-3 text-sm font-medium text-text-primary transition-colors hover:border-text-secondary hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Droplets size={16} aria-hidden="true" />
        )}
        {isPending
          ? "지갑에서 확인"
          : isConfirming
            ? "충전 중"
            : "1M Test USDC"}
      </button>
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="address"
      />
    </header>
  );
}
