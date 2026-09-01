"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRightLeft, CandlestickChart, Copy, LineChart, X } from "lucide-react";
import {
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { formatMarketCap, formatPercent, formatTokenAmount, formatUsd, truncateAddress } from "@/lib/format";
import { toGatewayUrl } from "@/lib/ipfs";
import { buildChartData, buildOhlcData, type ChartRange, useTradeHistory } from "@/hooks/useTradeHistory";
import { TradeCandlestickChart } from "@/components/token/TradeCandlestickChart";

const ANVIL_CHAIN_ID = 31337;
const BPS_DENOMINATOR = 10_000n;
const DEFAULT_SLIPPAGE = "1";
const SELL_PERCENTAGES = [10, 25, 50] as const;

type TradeSide = "buy" | "sell";
type ChartMode = "recharts" | "tradingview";
type ChartTimeframe = ChartRange | "all";

type TokenMetadata = {
  image?: string;
  description?: string;
};

function parseAmount(value: string) {
  try {
    const amount = parseUnits(value || "0", 18);
    return amount > 0n ? amount : 0n;
  } catch {
    return 0n;
  }
}

function getSellAmountOut(tokenAmount: bigint, tokenReserve: bigint, usdcReserve: bigint) {
  const grossAmountOut = (usdcReserve * tokenAmount) / (tokenReserve + tokenAmount);
  return grossAmountOut - grossAmountOut / 100n;
}

function getTokenAmountForSellOutput(
  desiredUsdcAmount: bigint,
  maxTokenAmount: bigint,
  tokenReserve: bigint,
  usdcReserve: bigint
) {
  if (desiredUsdcAmount === 0n || maxTokenAmount === 0n) return 0n;
  if (getSellAmountOut(maxTokenAmount, tokenReserve, usdcReserve) < desiredUsdcAmount) return 0n;

  let low = 1n;
  let high = maxTokenAmount;

  while (low < high) {
    const mid = (low + high) / 2n;
    if (getSellAmountOut(mid, tokenReserve, usdcReserve) >= desiredUsdcAmount) high = mid;
    else low = mid + 1n;
  }

  return low;
}

function formatChartTime(timestampSeconds: number, options: Intl.DateTimeFormatOptions) {
  return new Date(timestampSeconds * 1000).toLocaleTimeString([], options);
}

function formatChartPrice(price: number) {
  return `$${price.toFixed(6)}`;
}

export function TokenDashboard({ tokenAddress }: { tokenAddress: string }) {
  const validTokenAddress = isAddress(tokenAddress);
  const token = validTokenAddress ? tokenAddress : undefined;
  const { address: account, isConnected, chainId } = useAccount();
  const [side, setSide] = useState<TradeSide>("buy");
  const [chartMode, setChartMode] = useState<ChartMode>("recharts");
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>("1h");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
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
  const { data: tokenUri } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "tokenURI", query: { enabled: Boolean(token) } });
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
  const { trades, isLoading: isChartLoading, refetch: refetchTradeHistory } = useTradeHistory(curveAddress);
  const chartData = useMemo(
    () => chartTimeframe === "all" ? [] : buildChartData(trades, chartTimeframe),
    [chartTimeframe, trades]
  );
  const ohlcData = useMemo(() => buildOhlcData(trades), [trades]);
  const hasTradesInRange = chartData.some((point) => point.price !== null);

  const requestedAmount = parseAmount(amount);
  const sellTokenAmount = virtualTokenReserve && virtualUSDCReserve
    ? getTokenAmountForSellOutput(requestedAmount, tokenBalance ?? 0n, virtualTokenReserve, virtualUSDCReserve)
    : 0n;
  const amountIn = side === "buy" ? requestedAmount : sellTokenAmount;
  const slippageBps = Math.max(0, Math.round(Number(slippage) * 100));
  const validSlippage = Number.isFinite(slippageBps) && slippageBps <= 10_000;
  const { data: buyQuote } = useReadContract({
    address: curveAddress,
    abi: bondingCurveAbi,
    functionName: "getBuyAmountOut",
    args: side === "buy" && amountIn > 0n ? [amountIn] : undefined,
    query: { enabled: readEnabled && side === "buy" && amountIn > 0n },
  });
  const quote = side === "buy"
    ? buyQuote
    : virtualTokenReserve && virtualUSDCReserve && amountIn > 0n
      ? getSellAmountOut(amountIn, virtualTokenReserve, virtualUSDCReserve)
      : undefined;
  const minAmountOut = quote && validSlippage
    ? (quote * BigInt(BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR
    : 0n;
  const sellGrossAmountOut = side === "sell" && virtualTokenReserve && virtualUSDCReserve && amountIn > 0n
    ? (virtualUSDCReserve * amountIn) / (virtualTokenReserve + amountIn)
    : 0n;
  const fee = side === "buy" ? amountIn / 100n : sellGrossAmountOut - (quote ?? 0n);
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

  useEffect(() => {
    if (!tokenUri) {
      setMetadata(null);
      return;
    }

    let cancelled = false;
    const metadataUrl = toGatewayUrl(tokenUri);

    void fetch(metadataUrl)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((value: TokenMetadata) => {
        if (!cancelled) setMetadata(value);
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenUri]);

  const refetchDetails = () => {
    void Promise.all([refetchName(), refetchSymbol(), refetchTokenBalance(), refetchCreator(), refetchVirtualTokenReserve(), refetchVirtualUSDCReserve(), refetchRealTokenReserve(), refetchInitialTokenReserve(), refetchTotalSupply(), refetchUsdcBalance(), refetchUsdcAllowance(), refetchTokenAllowance(), refetchTradeHistory()]);
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
    const tokenAmount = (balance * BigInt(percentage)) / 100n;
    const usdcAmount = virtualTokenReserve && virtualUSDCReserve
      ? getSellAmountOut(tokenAmount, virtualTokenReserve, virtualUSDCReserve)
      : 0n;
    setAmount(formatUnits(usdcAmount, 18));
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

  const inputAsset = "fUSDC";
  const outputAsset = symbol ?? "Token";
  const imageUrl = metadata?.image ? toGatewayUrl(metadata.image) : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <section className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        {imageUrl ? <button type="button" onClick={() => setIsImageModalOpen(true)} className="size-16 shrink-0 overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"><img src={imageUrl} alt={`${name ?? "Token"} token image`} className="size-full object-cover" /></button> : <div className="size-16 shrink-0 rounded-lg border border-border bg-surface" />}
        <div className="min-w-0 flex-1"><p className="text-2xl font-semibold text-text-primary">{symbol ?? ""}</p><p className="mt-1 truncate text-sm text-text-secondary">{name ?? ""}</p></div>
        <div className="grid gap-2 text-[13px] text-text-secondary sm:text-right"><p>Token <span className="ml-2 font-financial text-text-primary">{truncateAddress(tokenAddress)}</span></p><p>Creator <span className="ml-2 font-financial text-text-primary">{creator ? truncateAddress(creator) : ""}</span></p>{isConnected && <p>Wallet balance <span className="ml-2 font-financial text-text-primary">{formatTokenAmount(tokenBalance ?? 0n)} {symbol}</span></p>}</div>
        <button type="button" onClick={copyAddress} title="Copy token address" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-strong px-3 text-[13px] text-text-primary hover:border-text-secondary"><Copy size={15} aria-hidden="true" /> Copy Address</button>
      </section>

      {isGraduated ? <Card><p className="text-sm font-medium text-info">Graduated</p><p className="mt-2 text-sm text-text-secondary">이 토큰은 AMM으로 이전되었습니다. AMM 거래 화면은 Phase 4에서 제공됩니다.</p></Card> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card><div className="grid gap-5"><div><div className="flex items-center gap-2"><button type="button" onClick={() => setShowPrice(!showPrice)} className="text-text-secondary hover:text-text-primary transition-colors" title="Toggle between Price and Market Cap"><ArrowRightLeft size={14} /></button><p className="text-[13px] font-medium text-text-secondary">{showPrice ? "Price" : "Market Cap"}</p></div><p className="mt-1 font-financial text-3xl font-semibold text-text-primary">{showPrice ? formatUsd(price) : formatMarketCap((price * (totalSupply ?? 0n)) / 10n ** 18n)}</p></div></div></Card>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-text-primary">{symbol ?? "TOKEN"} / fUSDC Live Chart</h2>
                <div className="flex items-center gap-3">
                  <div className="flex rounded-md border border-border bg-surface p-0.5">
                    {[
                      { value: "1h", label: "1H" },
                      { value: "24h", label: "24H" },
                      { value: "all", label: "ALL" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.value === "all"}
                        onClick={() => setChartTimeframe(option.value as ChartTimeframe)}
                        className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          chartTimeframe === option.value
                            ? "bg-primary text-background"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                  <button type="button" title="Recharts chart" onClick={() => setChartMode("recharts")} className={`flex size-8 items-center justify-center rounded-md ${chartMode === "recharts" ? "bg-surface-elevated text-primary" : "text-text-secondary hover:text-text-primary"}`}><LineChart className="size-4" /></button>
                  <button type="button" title="TradingView chart" onClick={() => setChartMode("tradingview")} className={`flex size-8 items-center justify-center rounded-md ${chartMode === "tradingview" ? "bg-surface-elevated text-primary" : "text-text-secondary hover:text-text-primary"}`}><CandlestickChart className="size-4" /></button>
                  </div>
                </div>
              </div>
              <div className="mt-4 h-64 border-y border-border">
                {chartMode === "tradingview" ? (
                  ohlcData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-text-muted">아직 거래 내역이 없습니다.</div>
                  ) : (
                    <TradeCandlestickChart data={ohlcData} />
                  )
                ) : isChartLoading ? (
                  <div className="flex h-full items-center justify-center text-[13px] text-text-muted">불러오는 중...</div>
                ) : !hasTradesInRange ? (
                  <div className="flex h-full items-center justify-center text-[13px] text-text-muted">아직 거래 내역이 없습니다.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value: number) => formatChartTime(value, { hour: "2-digit", minute: "2-digit" })}
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        dataKey="price"
                        domain={["auto", "auto"]}
                        tickFormatter={(value: number) => formatChartPrice(value)}
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <Tooltip
                        labelFormatter={(label) => formatChartTime(Number(label), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        formatter={(value) => [formatChartPrice(Number(value)), "Price"]}
                        contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "var(--color-text-secondary)" }}
                      />
                      <Line type="linear" dataKey="price" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            <Card><div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold text-text-primary">Bonding Curve Progress</h2><span className="font-financial text-sm text-primary">{formatPercent(progress)}</span></div><Progress ratio={progress} className="mt-4" /><div className="mt-3 flex justify-between text-[13px] text-text-secondary"><span>{formatTokenAmount((initialTokenReserve ?? 0n) - (realTokenReserve ?? 0n), 0)} / {formatTokenAmount(initialTokenReserve ?? 0n, 0)} tokens sold</span><span>Graduation at 100%</span></div></Card>
          </div>
          <Card className="h-fit"><div className="grid grid-cols-2 border-b border-border"><button type="button" onClick={() => { setSide("buy"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "buy" ? "border-b-2 border-primary text-primary" : "text-text-secondary"}`}>Buy {symbol}</button><button type="button" onClick={() => { setSide("sell"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "sell" ? "border-b-2 border-negative text-negative" : "text-text-secondary"}`}>Sell {symbol}</button></div><div className="mt-5 space-y-4"><Input id="trade-amount" label={side === "buy" ? "You pay" : "You receive"} suffix={inputAsset} inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isLoading} />{isConnected && <p className="-mt-2 text-[12px] text-text-secondary">Balance: {side === "buy" ? `${formatTokenAmount(usdcBalance ?? 0n)} Test USDC` : `${formatTokenAmount(tokenBalance ?? 0n)} ${symbol}`}</p>}{side === "sell" && isConnected && <div className="flex justify-end gap-1">{SELL_PERCENTAGES.map((percentage) => <button key={percentage} type="button" onClick={() => setSellPercentage(percentage)} disabled={isLoading || !tokenBalance} className="h-7 rounded-sm border border-border-strong px-2 font-financial text-text-secondary hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50">{percentage}%</button>)}<button type="button" onClick={() => setSellPercentage(100)} disabled={isLoading || !tokenBalance} className="h-7 rounded-sm border border-border-strong px-2 font-financial text-text-secondary hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50">MAX</button></div>}<div className="flex justify-center"><ArrowDown className="size-5 text-text-muted" /></div><div className="rounded-md border border-border bg-surface-elevated p-3 text-[13px]"><p className="text-text-secondary">{side === "buy" ? "You receive" : "You sell"}</p><p className="mt-1 font-financial text-xl text-text-primary">{side === "buy" ? (quote ? `≈ ${formatTokenAmount(quote)} ${outputAsset}` : "") : (amountIn > 0n ? `≈ ${formatTokenAmount(amountIn)} ${symbol}` : "")}</p></div><div className="rounded-md bg-surface-elevated p-3 text-[13px]"><div className="flex justify-between"><span className="text-text-secondary">Minimum received</span><span className="font-financial text-text-primary">{quote ? `${formatTokenAmount(minAmountOut)} ${side === "buy" ? outputAsset : "fUSDC"}` : ""}</span></div></div><Input id="slippage" label="Slippage tolerance" suffix="%" inputMode="decimal" placeholder="1.00" value={slippage} onChange={(event) => setSlippage(event.target.value)} disabled={isLoading} /><div className="grid grid-cols-2 gap-y-2 text-[13px]"><span className="text-text-secondary">Fee</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(fee)} {inputAsset}</span><span className="text-text-secondary">Protocol</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(protocolFee)} {inputAsset}</span><span className="text-text-secondary">Creator</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(creatorFee)} {inputAsset}</span></div>{txError && <p className="text-[13px] text-negative">{txError.message.split("\n")[0]}</p>}{!validSlippage && <p className="text-[13px] text-negative">Slippage는 0%에서 100% 사이여야 합니다.</p>}<Button variant={side === "buy" ? "primary" : "destructive"} className="w-full" onClick={handleTrade} loading={isLoading} disabled={!isConnected || chainId !== ANVIL_CHAIN_ID || !quote || !validSlippage}>{actionLabel}</Button>{!isConnected && <p className="text-center text-[13px] text-text-secondary">거래하려면 지갑을 연결해주세요.</p>}{isConnected && chainId !== ANVIL_CHAIN_ID && <p className="text-center text-[13px] text-warning">Anvil 네트워크로 전환해주세요.</p>}</div></Card>
        </div>
      )}
      <Card className="mt-6"><h2 className="text-[15px] font-semibold text-text-primary">About</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{metadata?.description ?? ""}</p></Card>
      {isImageModalOpen && imageUrl && (
        <div role="dialog" aria-modal="true" aria-label="Token image" onClick={() => setIsImageModalOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative flex h-[80vh] w-[80vw] items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <img src={imageUrl} alt={`${name ?? "Token"} token image`} className="max-h-full max-w-full object-contain" />
            <button type="button" onClick={() => setIsImageModalOpen(false)} aria-label="Close token image" className="absolute right-0 top-0 flex size-10 items-center justify-center rounded-md bg-black/40 text-white hover:bg-black/70"><X className="size-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}