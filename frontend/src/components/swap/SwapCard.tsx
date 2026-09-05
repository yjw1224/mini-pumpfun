"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ChevronDown, Settings } from "lucide-react";
import { formatUnits, parseUnits, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useTokenList, type TokenListItem } from "@/hooks/useTokenList";
import {
  bondingCurveAbi,
  FAKE_USDC_ADDRESS,
  fakeUSDCAbi,
  memeTokenAbi,
  simpleAmmAbi,
} from "@/lib/contracts";
import { formatPercent, formatTokenAmount } from "@/lib/format";

const ANVIL_CHAIN_ID = 31337;
const BPS_DENOMINATOR = 10_000n;
const AMM_FEE_BPS = 50n; // SimpleAMM.FEE — 0.5%
const DEFAULT_SLIPPAGE = "1";

type SwapDirection = "sell" | "buy"; // sell: Token → fUSDC, buy: fUSDC → Token

function parseAmount(value: string) {
  try {
    const amount = parseUnits(value || "0", 18);
    return amount > 0n ? amount : 0n;
  } catch {
    return 0n;
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-financial text-text-primary">{value}</span>
    </>
  );
}

function TokenPill({
  image,
  symbol,
  onClick,
}: {
  image?: string;
  symbol: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {image ? (
        <img src={image} alt={`${symbol} token image`} className="size-5 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="size-5 shrink-0 rounded-full border border-border bg-surface-elevated" />
      )}
      <span className="text-sm font-semibold text-text-primary">{symbol}</span>
      {onClick && <ChevronDown size={14} className="text-text-secondary" />}
    </>
  );

  if (!onClick) {
    return (
      <span className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface-elevated px-2.5">
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface-elevated px-2.5 transition-colors hover:border-text-secondary"
    >
      {content}
    </button>
  );
}

export function SwapCard() {
  const { address: account, isConnected, chainId } = useAccount();
  const { data: tokens, isLoading: isTokenListLoading } = useTokenList();
  const graduatedTokens = (tokens ?? []).filter((item) => item.graduated);

  const [selectedToken, setSelectedToken] = useState<TokenListItem | undefined>(undefined);
  const [direction, setDirection] = useState<SwapDirection>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isSlippageOpen, setIsSlippageOpen] = useState(false);
  const approvalHandled = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedToken && graduatedTokens.length > 0) {
      setSelectedToken(graduatedTokens[0]);
    }
  }, [graduatedTokens, selectedToken]);

  const token = selectedToken?.token;
  const curveAddress = selectedToken?.curve;
  const accountArgs = account ? ([account] as const) : undefined;

  const { data: amm } = useReadContract({
    address: curveAddress,
    abi: bondingCurveAbi,
    functionName: "amm",
    query: { enabled: Boolean(curveAddress) },
  });
  const ammAddress = amm && amm !== zeroAddress ? amm : undefined;
  const ammEnabled = Boolean(ammAddress);

  const { data: tokenReserve, refetch: refetchTokenReserve } = useReadContract({ address: ammAddress, abi: simpleAmmAbi, functionName: "tokenReserve", query: { enabled: ammEnabled } });
  const { data: usdcReserve, refetch: refetchUsdcReserve } = useReadContract({ address: ammAddress, abi: simpleAmmAbi, functionName: "usdcReserve", query: { enabled: ammEnabled } });
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "balanceOf", args: accountArgs, query: { enabled: Boolean(token && account) } });
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({ address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "balanceOf", args: accountArgs, query: { enabled: Boolean(account) } });
  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "allowance", args: account && ammAddress ? [account, ammAddress] : undefined, query: { enabled: Boolean(token && account && ammAddress) } });
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({ address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "allowance", args: account && ammAddress ? [account, ammAddress] : undefined, query: { enabled: Boolean(account && ammAddress) } });

  const amountIn = parseAmount(amount);
  const { data: quote } = useReadContract({
    address: ammAddress,
    abi: simpleAmmAbi,
    functionName: direction === "sell" ? "getTokenToUSDCAmountOut" : "getUSDCToTokenAmountOut",
    args: amountIn > 0n ? [amountIn] : undefined,
    query: { enabled: ammEnabled && amountIn > 0n },
  });

  const paySymbol = direction === "sell" ? (selectedToken?.symbol ?? "Token") : "fUSDC";
  const receiveSymbol = direction === "sell" ? "fUSDC" : (selectedToken?.symbol ?? "Token");
  const payBalance = direction === "sell" ? tokenBalance : usdcBalance;
  const exceedsBalance = amountIn > (payBalance ?? 0n);
  const effectiveQuote = exceedsBalance ? undefined : quote;
  const slippageBps = Math.max(0, Math.round(Number(slippage) * 100));
  const validSlippage = Number.isFinite(slippageBps) && slippageBps <= 10_000;
  const minAmountOut = effectiveQuote && validSlippage
    ? (effectiveQuote * (BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR
    : 0n;
  const fee = (amountIn * AMM_FEE_BPS) / BPS_DENOMINATOR;
  const allowance = direction === "sell" ? tokenAllowance : usdcAllowance;
  const requiresApproval = amountIn > 0n && (allowance ?? 0n) < amountIn;

  const priceImpact = (() => {
    const reserveIn = direction === "sell" ? tokenReserve : usdcReserve;
    const reserveOut = direction === "sell" ? usdcReserve : tokenReserve;
    if (!effectiveQuote || !reserveIn || !reserveOut || amountIn === 0n) return undefined;
    const spot = Number(formatUnits(reserveOut, 18)) / Number(formatUnits(reserveIn, 18));
    const execution = Number(formatUnits(effectiveQuote, 18)) / Number(formatUnits(amountIn, 18));
    if (spot <= 0) return undefined;
    return 1 - execution / spot;
  })();

  const { writeContract: writeApproval, data: approvalHash, isPending: isApprovalPending, error: approvalError } = useWriteContract();
  const { data: approvalReceipt, isLoading: isApprovalConfirming, error: approvalReceiptError } = useWaitForTransactionReceipt({ hash: approvalHash });
  const { writeContract: writeSwap, data: swapHash, isPending: isSwapPending, error: swapError } = useWriteContract();
  const { data: swapReceipt, isLoading: isSwapConfirming, error: swapReceiptError } = useWaitForTransactionReceipt({ hash: swapHash });
  const isLoading = isApprovalPending || isApprovalConfirming || isSwapPending || isSwapConfirming;

  const refetchDetails = () => {
    void Promise.all([
      refetchTokenReserve(), refetchUsdcReserve(), refetchTokenBalance(),
      refetchUsdcBalance(), refetchTokenAllowance(), refetchUsdcAllowance(),
    ]);
  };

  useEffect(() => {
    if (!approvalReceipt || !approvalHash || approvalHandled.current === approvalHash || !ammAddress) return;
    approvalHandled.current = approvalHash;
    writeSwap({
      chainId: ANVIL_CHAIN_ID,
      address: ammAddress,
      abi: simpleAmmAbi,
      functionName: direction === "sell" ? "swapTokenForUSDC" : "swapUSDCforToken",
      args: [amountIn, minAmountOut],
    });
  }, [approvalReceipt, approvalHash, direction, amountIn, minAmountOut, ammAddress, writeSwap]);

  useEffect(() => {
    if (swapReceipt) {
      setAmount("");
      refetchDetails();
    }
  }, [swapReceipt]);

  function handleSwap() {
    if (!ammAddress || !effectiveQuote || amountIn === 0n || exceedsBalance || !validSlippage) return;
    approvalHandled.current = undefined;
    if (requiresApproval) {
      if (direction === "sell" && token) {
        writeApproval({ chainId: ANVIL_CHAIN_ID, address: token, abi: memeTokenAbi, functionName: "approve", args: [ammAddress, amountIn] });
      } else if (direction === "buy") {
        writeApproval({ chainId: ANVIL_CHAIN_ID, address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "approve", args: [ammAddress, amountIn] });
      }
      return;
    }
    writeSwap({ chainId: ANVIL_CHAIN_ID, address: ammAddress, abi: simpleAmmAbi, functionName: direction === "sell" ? "swapTokenForUSDC" : "swapUSDCforToken", args: [amountIn, minAmountOut] });
  }

  function flipDirection() {
    setDirection((current) => (current === "sell" ? "buy" : "sell"));
    setAmount("");
  }

  function selectToken(item: TokenListItem) {
    setSelectedToken(item);
    setAmount("");
    setIsSelectorOpen(false);
  }

  if (isTokenListLoading) {
    return <Card className="mx-auto w-full max-w-md"><p className="text-sm text-text-secondary">토큰 목록을 불러오는 중입니다.</p></Card>;
  }

//   if (graduatedTokens.length === 0) {
//     return (
//       <Card className="mx-auto w-full max-w-md">
//         <h1 className="text-[15px] font-semibold text-text-primary">Swap</h1>
//         <p className="mt-3 text-sm text-text-secondary">아직 graduation된 토큰이 없습니다. AMM Swap은 graduation 이후에 사용할 수 있습니다.</p>
//       </Card>
//     );
//   }

  const txError = approvalError ?? approvalReceiptError ?? swapError ?? swapReceiptError;
  const actionLabel = isApprovalPending ? "지갑에서 승인" : isApprovalConfirming ? "승인 확인 중" : isSwapPending ? "지갑에서 확인" : isSwapConfirming ? "거래 확인 중" : requiresApproval ? "Approve" : "Swap";

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="flex items-center justify-between">
        <h1 className="text-[15px] font-semibold text-text-primary">Swap</h1>
        <button
          type="button"
          onClick={() => setIsSlippageOpen((open) => !open)}
          aria-label="Slippage settings"
          className={`flex size-8 items-center justify-center rounded-md ${isSlippageOpen ? "bg-surface-elevated text-primary" : "text-text-secondary hover:text-text-primary"}`}
        >
          <Settings size={16} />
        </button>
      </div>

      <div className="relative mt-4">
        {isSelectorOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsSelectorOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-surface-elevated p-1 shadow-lg">
              {graduatedTokens.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => selectToken(item)}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-surface"
                >
                  {item.image ? (
                    <img src={item.image} alt={`${item.symbol} token image`} className="size-6 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="size-6 shrink-0 rounded-full border border-border bg-surface" />
                  )}
                  <span className="text-sm font-semibold text-text-primary">{item.symbol}</span>
                  <span className="truncate text-[13px] text-text-secondary">{item.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-text-secondary">You pay</p>
            {isConnected && (
              <p className="text-[12px] text-text-secondary">
                Balance: <span className="font-financial">{formatTokenAmount(payBalance ?? 0n)} {paySymbol}</span>
              </p>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              disabled={isLoading}
              onChange={(event) => {
                if (!/^\d*\.?\d*$/.test(event.target.value)) return;
                setAmount(event.target.value);
              }}
              className="h-10 w-full min-w-0 bg-transparent font-financial text-xl text-text-primary outline-none placeholder:text-text-muted"
            />
            {direction === "sell" ? (
              <TokenPill image={selectedToken?.image} symbol={selectedToken?.symbol ?? "Select"} onClick={() => setIsSelectorOpen(true)} />
            ) : (
              <TokenPill symbol="fUSDC" />
            )}
          </div>
        </div>

        <div className="relative z-0 -my-2 flex justify-center">
          <button
            type="button"
            onClick={flipDirection}
            aria-label="Flip swap direction"
            className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
          >
            <ArrowDown size={16} />
          </button>
        </div>

        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-[13px] font-medium text-text-secondary">You receive</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="h-10 w-full min-w-0 truncate font-financial text-xl leading-10 text-text-primary">
              {effectiveQuote ? `≈ ${formatTokenAmount(effectiveQuote)}` : ""}
            </p>
            {direction === "buy" ? (
              <TokenPill image={selectedToken?.image} symbol={selectedToken?.symbol ?? "Select"} onClick={() => setIsSelectorOpen(true)} />
            ) : (
              <TokenPill symbol="fUSDC" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-2 rounded-md bg-surface-elevated p-3 text-[13px]">
        <DetailRow label="Minimum received" value={effectiveQuote ? `${formatTokenAmount(minAmountOut)} ${receiveSymbol}` : ""} />
        <DetailRow label="Fee (0.5%)" value={amountIn > 0n ? `${formatTokenAmount(fee)} ${paySymbol}` : ""} />
        <DetailRow label="Price impact" value={priceImpact !== undefined ? formatPercent(priceImpact, 2) : ""} />
      </div>

      {isSlippageOpen && (
        <div className="mt-4">
          <Input id="slippage" label="Slippage tolerance" suffix="%" inputMode="decimal" placeholder="1.00" value={slippage} onChange={(event) => setSlippage(event.target.value)} disabled={isLoading} />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {txError && <p className="text-[13px] text-negative">{txError.message.split("\n")[0]}</p>}
        {!validSlippage && <p className="text-[13px] text-negative">Slippage는 0%에서 100% 사이여야 합니다.</p>}
        {exceedsBalance && <p className="text-[13px] text-negative">잔액이 부족합니다.</p>}
        <Button
          variant="primary"
          className="w-full"
          onClick={handleSwap}
          loading={isLoading}
          disabled={!isConnected || chainId !== ANVIL_CHAIN_ID || !effectiveQuote || !validSlippage || exceedsBalance}
        >
          {actionLabel}
        </Button>
        {!isConnected && <p className="text-center text-[13px] text-text-secondary">스왑하려면 지갑을 연결해주세요.</p>}
        {isConnected && chainId !== ANVIL_CHAIN_ID && <p className="text-center text-[13px] text-warning">Anvil 네트워크로 전환해주세요.</p>}
      </div>
    </Card>
  );
}
