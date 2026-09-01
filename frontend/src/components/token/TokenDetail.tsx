"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, LoaderCircle } from "lucide-react";
import { formatUnits, isAddress, parseUnits, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import {
  bondingCurveAbi,
  FACTORY_ADDRESS,
  factoryAbi,
  FAKE_USDC_ADDRESS,
  fakeUSDCAbi,
  memeTokenAbi,
} from "@/lib/contracts";
import { formatPercent, formatTokenAmount, formatUsd, truncateAddress } from "@/lib/format";

const ANVIL_CHAIN_ID = 31337;
const BPS_DENOMINATOR = 10_000n;
const DEFAULT_SLIPPAGE = "1";
const SELL_PERCENTAGES = [10, 25, 50] as const;

type TradeSide = "buy" | "sell";

function parseAmount(value: string) {
  try {
    const amount = parseUnits(value || "0", 18);
    return amount > 0n ? amount : 0n;
  } catch {
    return 0n;
  }
}

export function TokenDetail({ tokenAddress }: { tokenAddress: string }) {
  const validTokenAddress = isAddress(tokenAddress);
  const token = validTokenAddress ? tokenAddress : undefined;
  const { address: account, isConnected, chainId } = useAccount();
  const [side, setSide] = useState<TradeSide>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const approvalHandled = useRef<string | undefined>(undefined);

  const { data: curve } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "tokenToCurve",
    args: token ? [token] : undefined,
    query: { enabled: Boolean(token) && isAddress(FACTORY_ADDRESS) },
  });
  const curveAddress = curve && curve !== zeroAddress ? curve : undefined;
  const readEnabled = Boolean(token && curveAddress);
  const accountArgs = account ? ([account] as const) : undefined;

  const { data: name, refetch: refetchName } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "name", query: { enabled: Boolean(token) } });
  const { data: symbol, refetch: refetchSymbol } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "symbol", query: { enabled: Boolean(token) } });
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "balanceOf", args: accountArgs, query: { enabled: Boolean(token && account) } });
  const { data: creator, refetch: refetchCreator } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "creator", query: { enabled: readEnabled } });
  const { data: virtualTokenReserve, refetch: refetchVirtualTokenReserve } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "virtualTokenReserve", query: { enabled: readEnabled } });
  const { data: virtualUSDCReserve, refetch: refetchVirtualUSDCReserve } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "virtualUSDCReserve", query: { enabled: readEnabled } });
  const { data: realTokenReserve, refetch: refetchRealTokenReserve } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "realTokenReserve", query: { enabled: readEnabled } });
  const { data: initialTokenReserve, refetch: refetchInitialTokenReserve } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "INITIAL_TOKEN_RESERVE", query: { enabled: readEnabled } });
  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "TOTAL_SUPPLY", query: { enabled: readEnabled } });
  const { data: amm } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "amm", query: { enabled: readEnabled } });
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({ address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "balanceOf", args: accountArgs, query: { enabled: Boolean(account) && isAddress(FAKE_USDC_ADDRESS) } });
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({ address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "allowance", args: account && curveAddress ? [account, curveAddress] : undefined, query: { enabled: Boolean(account && curveAddress) && isAddress(FAKE_USDC_ADDRESS) } });
  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "allowance", args: account && curveAddress ? [account, curveAddress] : undefined, query: { enabled: Boolean(token && account && curveAddress) } });

  const amountIn = parseAmount(amount);
  const slippageBps = Math.max(0, Math.round(Number(slippage) * 100));
  const validSlippage = Number.isFinite(slippageBps) && slippageBps <= 10_000;
  const { data: quote } = useReadContract({
    address: curveAddress,
    abi: bondingCurveAbi,
    functionName: side === "buy" ? "getBuyAmountOut" : "getSellAmountOut",
    args: amountIn > 0n ? [amountIn] : undefined,
    query: { enabled: readEnabled && amountIn > 0n },
  });
  const minAmountOut = quote && validSlippage
    ? (quote * BigInt(BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR
    : 0n;
  const fee = amountIn / 100n;
  const protocolFee = (fee * 70n) / 100n;
  const creatorFee = fee - protocolFee;
  const allowance = side === "buy" ? usdcAllowance : tokenAllowance;
  const requiresApproval = amountIn > 0n && (allowance ?? 0n) < amountIn;
  const isGraduated = amm !== undefined && amm !== zeroAddress;
  const price = virtualTokenReserve && virtualUSDCReserve
    ? (virtualUSDCReserve * 10n ** 18n) / virtualTokenReserve
    : 0n;
  const progress = initialTokenReserve && realTokenReserve !== undefined
    ? Number(initialTokenReserve - realTokenReserve) / Number(initialTokenReserve)
    : 0;

  const { writeContract: writeApproval, data: approvalHash, isPending: isApprovalPending, error: approvalError } = useWriteContract();
  const { data: approvalReceipt, isLoading: isApprovalConfirming, error: approvalReceiptError } = useWaitForTransactionReceipt({ hash: approvalHash });
  const { writeContract: writeTrade, data: tradeHash, isPending: isTradePending, error: tradeError } = useWriteContract();
  const { data: tradeReceipt, isLoading: isTradeConfirming, error: tradeReceiptError } = useWaitForTransactionReceipt({ hash: tradeHash });
  const isLoading = isApprovalPending || isApprovalConfirming || isTradePending || isTradeConfirming;

  const refetchDetails = () => {
    void Promise.all([refetchName(), refetchSymbol(), refetchTokenBalance(), refetchCreator(), refetchVirtualTokenReserve(), refetchVirtualUSDCReserve(), refetchRealTokenReserve(), refetchInitialTokenReserve(), refetchTotalSupply(), refetchUsdcBalance(), refetchUsdcAllowance(), refetchTokenAllowance()]);
  };

  useEffect(() => {
    if (!approvalReceipt || !approvalHash || approvalHandled.current === approvalHash || !curveAddress) return;
    approvalHandled.current = approvalHash;
    if (side === "buy") {
      writeTrade({ chainId: ANVIL_CHAIN_ID, address: curveAddress, abi: bondingCurveAbi, functionName: "buy", args: [amountIn, minAmountOut] });
    } else {
      writeTrade({ chainId: ANVIL_CHAIN_ID, address: curveAddress, abi: bondingCurveAbi, functionName: "sell", args: [amountIn, minAmountOut] });
    }
  }, [approvalReceipt, approvalHash, side, amountIn, minAmountOut, curveAddress, writeTrade]);

  useEffect(() => {
    if (tradeReceipt) refetchDetails();
  }, [tradeReceipt]);

  function handleTrade() {
    if (!curveAddress || !quote || amountIn === 0n || !validSlippage) return;
    approvalHandled.current = undefined;
    if (requiresApproval) {
      if (side === "buy") {
        writeApproval({ chainId: ANVIL_CHAIN_ID, address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "approve", args: [curveAddress, amountIn] });
      } else if (token) {
        writeApproval({ chainId: ANVIL_CHAIN_ID, address: token, abi: memeTokenAbi, functionName: "approve", args: [curveAddress, amountIn] });
      }
      return;
    }
    writeTrade({ chainId: ANVIL_CHAIN_ID, address: curveAddress, abi: bondingCurveAbi, functionName: side === "buy" ? "buy" : "sell", args: [amountIn, minAmountOut] });
  }

  function setSellPercentage(percentage: number) {
    const balance = tokenBalance ?? 0n;
    setAmount(formatUnits((balance * BigInt(percentage)) / 100n, 18));
  }

  function copyAddress() {
    void navigator.clipboard.writeText(tokenAddress);
  }

  if (!validTokenAddress) {
    return <p className="text-sm text-negative">올바르지 않은 토큰 주소입니다.</p>;
  }

  if (!curveAddress) {
    return <p className="text-sm text-text-secondary">토큰 정보를 불러오는 중입니다.</p>;
  }

  const actionLabel = isApprovalPending ? "지갑에서 승인" : isApprovalConfirming ? "승인 확인 중" : isTradePending ? "지갑에서 확인" : isTradeConfirming ? "거래 확인 중" : requiresApproval ? "Approve" : side === "buy" ? `Buy ${symbol ?? "Token"}` : `Sell ${symbol ?? "Token"}`;
  const txError = approvalError ?? approvalReceiptError ?? tradeError ?? tradeReceiptError;

  return (
    <div className="mx-auto max-w-5xl">
      <section className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-2xl font-semibold text-text-primary">{symbol ?? "..."}</p>
          <p className="mt-1 text-sm text-text-secondary">{name ?? "Loading token..."}</p>
        </div>
        <div className="grid gap-2 text-[13px] text-text-secondary sm:text-right">
          <p>Token <span className="ml-2 font-financial text-text-primary">{truncateAddress(tokenAddress)}</span></p>
          <p>Creator <span className="ml-2 font-financial text-text-primary">{creator ? truncateAddress(creator) : "..."}</span></p>
          {isConnected && <p>Wallet balance <span className="ml-2 font-financial text-text-primary">{formatTokenAmount(tokenBalance ?? 0n)} {symbol}</span></p>}
        </div>
        <button type="button" onClick={copyAddress} title="Copy token address" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-strong px-3 text-[13px] text-text-primary hover:border-text-secondary">
          <Copy size={15} aria-hidden="true" /> Copy Address
        </button>
      </section>

      {isGraduated ? (
        <Card><p className="text-sm font-medium text-info">Graduated</p><p className="mt-2 text-sm text-text-secondary">이 토큰은 AMM으로 이전되었습니다. AMM 거래 화면은 Phase 4에서 제공됩니다.</p></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><p className="text-[13px] text-text-secondary">Price</p><p className="mt-1 font-financial text-xl text-text-primary">{formatUsd(price)}</p></div>
                <div><p className="text-[13px] text-text-secondary">Market Cap</p><p className="mt-1 font-financial text-xl text-text-primary">{formatUsd((price * (totalSupply ?? 0n)) / 10n ** 18n, 0)}</p></div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold text-text-primary">Bonding Curve Progress</h2><span className="font-financial text-sm text-primary">{formatPercent(progress)}</span></div>
              <Progress ratio={progress} className="mt-4" />
              <div className="mt-3 flex justify-between text-[13px] text-text-secondary"><span>{formatTokenAmount((initialTokenReserve ?? 0n) - (realTokenReserve ?? 0n), 0)} / {formatTokenAmount(initialTokenReserve ?? 0n, 0)} tokens sold</span><span>Graduation at 100%</span></div>
            </Card>
            <Card>
              <h2 className="text-[15px] font-semibold text-text-primary">Reserves</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]"><span className="text-text-secondary">Token reserve</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(realTokenReserve ?? 0n)} {symbol}</span><span className="text-text-secondary">USDC reserve</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(virtualUSDCReserve ?? 0n)} USDC</span></div>
            </Card>
          </div>

          <Card className="h-fit">
            <div className="grid grid-cols-2 border-b border-border"><button type="button" onClick={() => { setSide("buy"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "buy" ? "border-b-2 border-primary text-primary" : "text-text-secondary"}`}>Buy {symbol}</button><button type="button" onClick={() => { setSide("sell"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "sell" ? "border-b-2 border-primary text-primary" : "text-text-secondary"}`}>Sell {symbol}</button></div>
            <div className="mt-5 space-y-4">
              <Input id="trade-amount" label={side === "buy" ? "USDC" : symbol ?? "Token"} suffix={side === "buy" ? "USDC" : symbol} inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isLoading} />
              {side === "sell" && isConnected && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="text-text-secondary">Available: <span className="font-financial text-text-primary">{formatTokenAmount(tokenBalance ?? 0n)} {symbol}</span></span>
                  <div className="flex gap-1">
                    {SELL_PERCENTAGES.map((percentage) => (
                      <button key={percentage} type="button" onClick={() => setSellPercentage(percentage)} disabled={isLoading || !tokenBalance} className="h-7 rounded-sm border border-border-strong px-2 font-financial text-text-secondary hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50">{percentage}%</button>
                    ))}
                    <button type="button" onClick={() => setSellPercentage(100)} disabled={isLoading || !tokenBalance} className="h-7 rounded-sm border border-border-strong px-2 font-financial text-text-secondary hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50">MAX</button>
                  </div>
                </div>
              )}
              <div className="rounded-md bg-surface-elevated p-3 text-[13px]"><div className="flex justify-between"><span className="text-text-secondary">You receive</span><span className="font-financial text-text-primary">{quote ? `≈ ${formatTokenAmount(quote)} ${side === "buy" ? symbol : "USDC"}` : "-"}</span></div><div className="mt-2 flex justify-between"><span className="text-text-secondary">Minimum received</span><span className="font-financial text-text-primary">{quote ? `${formatTokenAmount(minAmountOut)} ${side === "buy" ? symbol : "USDC"}` : "-"}</span></div></div>
              <Input id="slippage" label="Slippage tolerance" suffix="%" inputMode="decimal" placeholder="1.00" value={slippage} onChange={(event) => setSlippage(event.target.value)} disabled={isLoading} />
              <div className="grid grid-cols-2 gap-y-2 text-[13px]"><span className="text-text-secondary">Fee</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(fee)} {side === "buy" ? "USDC" : symbol}</span><span className="text-text-secondary">Protocol</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(protocolFee)} {side === "buy" ? "USDC" : symbol}</span><span className="text-text-secondary">Creator</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(creatorFee)} {side === "buy" ? "USDC" : symbol}</span></div>
              {isConnected && side === "buy" && <p className="text-[12px] text-text-secondary">Available: {formatTokenAmount(usdcBalance ?? 0n)} Test USDC</p>}
              {txError && <p className="text-[13px] text-negative">{txError.message.split("\n")[0]}</p>}
              {!validSlippage && <p className="text-[13px] text-negative">Slippage는 0%에서 100% 사이여야 합니다.</p>}
              <Button className="w-full" onClick={handleTrade} loading={isLoading} disabled={!isConnected || chainId !== ANVIL_CHAIN_ID || !quote || !validSlippage}>{actionLabel}</Button>
              {!isConnected && <p className="text-center text-[13px] text-text-secondary">거래하려면 지갑을 연결해주세요.</p>}
              {isConnected && chainId !== ANVIL_CHAIN_ID && <p className="text-center text-[13px] text-warning">Anvil 네트워크로 전환해주세요.</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}