"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, CandlestickChart, Copy, LineChart, X } from "lucide-react";
import {
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
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
import { buildAllChartData, buildChartData, buildOhlcData, type ChartRange, useTokenCreatedAt, useTradeHistory } from "@/hooks/useTradeHistory";
import { TradeCandlestickChart } from "@/components/token/TradeCandlestickChart";

const ANVIL_CHAIN_ID = 31337;
const BPS_DENOMINATOR = 10_000n;
const DEFAULT_SLIPPAGE = "1";
const SELL_PERCENTAGES = [10, 25, 50] as const;

type TradeSide = "buy" | "sell";
type ChartMode = "recharts" | "tradingview";
type ChartTimeframe = ChartRange | "all";
type TokenMetadata = Record<string, unknown>;

function parseAmount(value: string) {
  try {
    const amount = parseUnits(value || "0", 18);
    return amount > 0n ? amount : 0n;
  } catch {
    return 0n;
  }
}

function formatChartTime(timestampSeconds: number, options: Intl.DateTimeFormatOptions) {
  return new Date(timestampSeconds * 1000).toLocaleTimeString([], options);
}

function formatChartPrice(price: number) {
  return `$${price.toFixed(6)}`;
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="mt-1 font-financial text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function ChartControls({
  chartMode,
  chartTimeframe,
  setChartMode,
  setChartTimeframe,
}: {
  chartMode: ChartMode;
  chartTimeframe: ChartTimeframe;
  setChartMode: (mode: ChartMode) => void;
  setChartTimeframe: (timeframe: ChartTimeframe) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border border-border bg-surface p-0.5">
        {([["1h", "1H"], ["24h", "24H"], ["all", "ALL"]] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setChartTimeframe(value)} className={`rounded px-2 py-1 text-[11px] font-semibold ${chartTimeframe === value ? "bg-primary text-background" : "text-text-secondary hover:text-text-primary"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <button type="button" title="Recharts" aria-label="Recharts" onClick={() => setChartMode("recharts")} className={`flex size-8 items-center justify-center rounded-md ${chartMode === "recharts" ? "bg-surface-elevated text-primary" : "text-text-secondary hover:text-text-primary"}`}>
          <LineChart className="size-4" />
        </button>
        <button type="button" title="TradingView-style" aria-label="TradingView-style" onClick={() => setChartMode("tradingview")} className={`flex size-8 items-center justify-center rounded-md ${chartMode === "tradingview" ? "bg-surface-elevated text-primary" : "text-text-secondary hover:text-text-primary"}`}>
          <CandlestickChart className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-financial text-text-primary">{value}</span>
    </>
  );
}

function TradeAmountBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-[13px] font-medium text-text-secondary">{label}</p>
      {children}
    </div>
  );
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
  const { data: initialMcap } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "INITIAL_MCAP", query: { enabled: readEnabled } });
  const { data: amm } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "amm", query: { enabled: readEnabled } });
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({ address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "balanceOf", args: accountArgs, query: { enabled: Boolean(account) && isAddress(FAKE_USDC_ADDRESS) } });
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({ address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "allowance", args: account && curveAddress ? [account, curveAddress] : undefined, query: { enabled: Boolean(account && curveAddress) && isAddress(FAKE_USDC_ADDRESS) } });
  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({ address: token, abi: memeTokenAbi, functionName: "allowance", args: account && curveAddress ? [account, curveAddress] : undefined, query: { enabled: Boolean(token && account && curveAddress) } });

  const { trades, isLoading: isChartLoading, refetch: refetchTradeHistory } = useTradeHistory(curveAddress);
  const { data: createdAt, isLoading: isCreatedAtLoading } = useTokenCreatedAt(token);
  const initialPrice = initialMcap !== undefined && totalSupply !== undefined
    ? Number(formatUnits((initialMcap * 10n ** 18n) / totalSupply, 18))
    : 0;
  const chartData = useMemo(() => chartTimeframe === "all" && createdAt !== undefined
    ? buildAllChartData(trades, createdAt, initialPrice)
    : chartTimeframe === "all" ? [] : buildChartData(trades, chartTimeframe),
    [chartTimeframe, createdAt, initialPrice, trades]);
  const ohlcData = useMemo(() => buildOhlcData(trades), [trades]);
  const hasTradesInRange = chartData.some((point) => point.price !== null);
  const averagePrice = useMemo(() => {
    if (!account) return undefined;

    const userTrades = trades.filter(
      (trade) => trade.trader.toLowerCase() === account.toLowerCase()
    );
    let held = 0n;
    let costBasis = 0n;

    for (const trade of userTrades) {
      if (trade.type === "buy") {
        held += trade.tokenAmount;
        costBasis += trade.usdcAmount;
      } else if (held > 0n) {
        const sold = trade.tokenAmount > held ? held : trade.tokenAmount;
        costBasis -= (costBasis * sold) / held;
        held -= sold;
      }
    }

    return held > 0n ? Number(formatUnits((costBasis * 10n ** 18n) / held, 18)) : undefined;
  }, [account, trades]);

  const price = virtualTokenReserve && virtualUSDCReserve
    ? (virtualUSDCReserve * 10n ** 18n) / virtualTokenReserve
    : 0n;
  const amountIn = parseAmount(amount);
  const sellTokenAmount = side === "sell" && price > 0n
    ? (amountIn * 10n ** 18n) / price
    : amountIn;
  const tradeAmountIn = side === "sell" ? sellTokenAmount : amountIn;
  const slippageBps = Math.max(0, Math.round(Number(slippage) * 100));
  const validSlippage = Number.isFinite(slippageBps) && slippageBps <= 10_000;
  const { data: quote } = useReadContract({
    address: curveAddress,
    abi: bondingCurveAbi,
    functionName: side === "buy" ? "getBuyAmountOut" : "getSellAmountOut",
    args: tradeAmountIn > 0n ? [tradeAmountIn] : undefined,
    query: { enabled: readEnabled && tradeAmountIn > 0n },
  });
  const availableBalance = side === "buy" ? usdcBalance : tokenBalance;
  const exceedsBalance = tradeAmountIn > (availableBalance ?? 0n);
  const effectiveQuote = exceedsBalance ? undefined : quote;
  const averagePriceWei = averagePrice !== undefined
    ? BigInt(Math.round(averagePrice * 10 ** 18))
    : undefined;
  const sellCostBasis = averagePriceWei !== undefined
    ? (averagePriceWei * tradeAmountIn) / 10n ** 18n
    : undefined;
  const expectedSellPnl = side === "sell" && effectiveQuote !== undefined && sellCostBasis !== undefined
    ? effectiveQuote - sellCostBasis
    : undefined;
  const expectedSellReturn = expectedSellPnl !== undefined && sellCostBasis !== undefined && sellCostBasis > 0n
    ? Number(expectedSellPnl) / Number(sellCostBasis)
    : undefined;
  const minAmountOut = effectiveQuote && validSlippage
    ? (effectiveQuote * BigInt(BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR
    : 0n;
  const fee = side === "buy" ? amountIn / 100n : effectiveQuote ? ((effectiveQuote * 100n) / 99n) - effectiveQuote : 0n;
  const protocolFee = (fee * 70n) / 100n;
  const creatorFee = fee - protocolFee;
  const allowance = side === "buy" ? usdcAllowance : tokenAllowance;
  const requiresApproval = tradeAmountIn > 0n && (allowance ?? 0n) < tradeAmountIn;
  const isGraduated = amm !== undefined && amm !== zeroAddress;
  const marketCap = (price * (totalSupply ?? 0n)) / 10n ** 18n;
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
    void fetch(toGatewayUrl(tokenUri))
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((value: TokenMetadata) => {
        if (!cancelled) setMetadata(value);
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      });
    return () => { cancelled = true; };
  }, [tokenUri]);

  const refetchDetails = () => {
    void Promise.all([
      refetchName(), refetchSymbol(), refetchTokenBalance(), refetchCreator(),
      refetchVirtualTokenReserve(), refetchVirtualUSDCReserve(), refetchRealTokenReserve(),
      refetchInitialTokenReserve(), refetchTotalSupply(), refetchUsdcBalance(),
      refetchUsdcAllowance(), refetchTokenAllowance(), refetchTradeHistory(),
    ]);
  };

  useEffect(() => {
    if (!approvalReceipt || !approvalHash || approvalHandled.current === approvalHash || !curveAddress) return;
    approvalHandled.current = approvalHash;
    writeTrade({
      chainId: ANVIL_CHAIN_ID,
      address: curveAddress,
      abi: bondingCurveAbi,
      functionName: side === "buy" ? "buy" : "sell",
      args: [tradeAmountIn, minAmountOut],
    });
  }, [approvalReceipt, approvalHash, side, tradeAmountIn, minAmountOut, curveAddress, writeTrade]);

  useEffect(() => {
    if (tradeReceipt) refetchDetails();
  }, [tradeReceipt]);

  function handleTrade() {
    if (!curveAddress || !effectiveQuote || amountIn === 0n || exceedsBalance || !validSlippage) return;
    approvalHandled.current = undefined;
    if (requiresApproval) {
      if (side === "buy") {
        writeApproval({ chainId: ANVIL_CHAIN_ID, address: FAKE_USDC_ADDRESS, abi: fakeUSDCAbi, functionName: "approve", args: [curveAddress, tradeAmountIn] });
      } else if (token) {
        writeApproval({ chainId: ANVIL_CHAIN_ID, address: token, abi: memeTokenAbi, functionName: "approve", args: [curveAddress, tradeAmountIn] });
      }
      return;
    }
    writeTrade({ chainId: ANVIL_CHAIN_ID, address: curveAddress, abi: bondingCurveAbi, functionName: side === "buy" ? "buy" : "sell", args: [tradeAmountIn, minAmountOut] });
  }

  function setSellPercentage(percentage: number) {
    const balance = tokenBalance ?? 0n;
    const tokenAmount = (balance * BigInt(percentage)) / 100n;
    setAmount(formatUnits((tokenAmount * price) / 10n ** 18n, 18));
  }

  function copyAddress() {
    void navigator.clipboard.writeText(tokenAddress);
  }

  if (!validTokenAddress) return <p className="text-sm text-negative">올바르지 않은 토큰 주소입니다.</p>;
  if (!curveAddress) return <p className="text-sm text-text-secondary">토큰 정보를 불러오는 중입니다.</p>;

  const imageUrl = typeof metadata?.image === "string" ? toGatewayUrl(metadata.image) : undefined;
  const metadataEntries = metadata ? Object.entries(metadata) : [];
  const actionLabel = isApprovalPending ? "지갑에서 승인" : isApprovalConfirming ? "승인 확인 중" : isTradePending ? "지갑에서 확인" : isTradeConfirming ? "거래 확인 중" : requiresApproval ? "Approve" : side === "buy" ? `Buy ${symbol ?? "Token"}` : `Sell ${symbol ?? "Token"}`;
  const txError = approvalError ?? approvalReceiptError ?? tradeError ?? tradeReceiptError;

  return (
    <div className="mx-auto max-w-6xl">
      <section className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        {imageUrl ? (
          <button type="button" onClick={() => setIsImageModalOpen(true)} className="size-16 shrink-0 overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary">
            <img src={imageUrl} alt={`${name ?? "Token"} token image`} className="size-full object-cover" />
          </button>
        ) : <div className="size-16 shrink-0 rounded-lg border border-border bg-surface" />}
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-semibold text-text-primary">{symbol ?? ""}</p>
          <p className="mt-1 truncate text-sm text-text-secondary">{name ?? ""}</p>
        </div>
        <div className="grid gap-2 text-[13px] text-text-secondary sm:text-right">
          <p>Token <span className="ml-2 font-financial text-text-primary">{truncateAddress(tokenAddress)}</span></p>
          <p>Creator <span className="ml-2 font-financial text-text-primary">{creator ? truncateAddress(creator) : ""}</span></p>
          {isConnected && <p>Balance <span className="ml-2 font-financial text-text-primary">{formatTokenAmount(tokenBalance ?? 0n)} {symbol}</span></p>}
        </div>
        <button type="button" onClick={copyAddress} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-strong px-3 text-[13px] text-text-primary hover:border-text-secondary">
          <Copy size={15} aria-hidden="true" /> Copy Address
        </button>
      </section>

      {!isGraduated ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <div className="grid grid-cols-2 gap-6">
                <Stat label="Price" value={formatUsd(price)} />
                <Stat label="Market Cap" value={formatMarketCap(marketCap)} />
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-text-primary">{symbol ?? "TOKEN"} / fUSDC Chart</h2>
                <ChartControls chartMode={chartMode} chartTimeframe={chartTimeframe} setChartMode={setChartMode} setChartTimeframe={setChartTimeframe} />
              </div>
              <div className="mt-4 h-64 border-y border-border">
                {chartMode === "tradingview" ? (
                  ohlcData.length === 0 ? <div className="flex h-full items-center justify-center text-[13px] text-text-muted">아직 거래 내역이 없습니다.</div> : <TradeCandlestickChart data={ohlcData} />
                ) : isChartLoading || (chartTimeframe === "all" && isCreatedAtLoading) ? (
                  <div className="flex h-full items-center justify-center text-[13px] text-text-muted">불러오는 중...</div>
                ) : !hasTradesInRange ? (
                  <div className="flex h-full items-center justify-center text-[13px] text-text-muted">아직 거래 내역이 없습니다.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="timestamp" tickFormatter={(value: number) => formatChartTime(value, { hour: "2-digit", minute: "2-digit" })} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="price" dataKey="price" domain={["auto", "auto"]} tickFormatter={(value: number) => formatChartPrice(value)} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={70} />
                      <Tooltip labelFormatter={(label) => formatChartTime(Number(label), { hour: "2-digit", minute: "2-digit", second: "2-digit" })} formatter={(value) => [formatChartPrice(Number(value)), "Price"]} contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                      <Line yAxisId="price" type="linear" dataKey="price" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                      {averagePrice !== undefined && <ReferenceLine yAxisId="price" y={averagePrice} stroke="var(--color-text-muted)" strokeDasharray="4 4" label={{ value: "Average Buy Price", fill: "var(--color-text-muted)", fontSize: 11, position: "insideTopLeft" }} />}
                    </RechartsLineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold text-text-primary">Bonding Curve Progress</h2><span className="font-financial text-sm text-primary">{formatPercent(progress)}</span></div>
              <Progress ratio={progress} className="mt-4" />
              <div className="mt-3 flex justify-between text-[13px] text-text-secondary"><span>{formatTokenAmount((initialTokenReserve ?? 0n) - (realTokenReserve ?? 0n), 0)} / {formatTokenAmount(initialTokenReserve ?? 0n, 0)} tokens sold</span><span>Graduation at 100%</span></div>
            </Card>
          </div>

          <Card className="h-fit">
            <div className="grid grid-cols-2 border-b border-border">
              <button type="button" onClick={() => { setSide("buy"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "buy" ? "border-b-2 border-primary text-primary" : "text-text-secondary"}`}>Buy {symbol}</button>
              <button type="button" onClick={() => { setSide("sell"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "sell" ? "border-b-2 border-negative text-negative" : "text-text-secondary"}`}>Sell {symbol}</button>
            </div>
            <div className="mt-5 space-y-4">
              <TradeAmountBox label="You pay">
                <div className="mt-2 flex items-center gap-2">
                  <Input id="trade-amount" label="" suffix="fUSDC" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isLoading} />
                </div>
                {side === "sell" && <p className="mt-2 font-financial text-[12px] text-text-secondary">≈ {formatTokenAmount(tradeAmountIn, 2)} {symbol ?? "Token"}</p>}
                {isConnected && <p className="mt-2 text-[12px] text-text-secondary">Balance: {side === "buy" ? `${formatTokenAmount(usdcBalance ?? 0n)} fUSDC` : `${formatUsd((tokenBalance ?? 0n) * price / 10n ** 18n, 2)} fUSDC`}</p>}
                {side === "sell" && isConnected && <div className="mt-2 flex justify-end gap-1">{SELL_PERCENTAGES.map((percentage) => <button key={percentage} type="button" onClick={() => setSellPercentage(percentage)} disabled={isLoading || !tokenBalance} className="h-7 rounded border border-border-strong px-2 font-financial text-[12px] text-text-secondary hover:text-text-primary disabled:opacity-50">{percentage}%</button>)}<button type="button" onClick={() => setSellPercentage(100)} disabled={isLoading || !tokenBalance} className="h-7 rounded border border-border-strong px-2 font-financial text-[12px] text-text-secondary hover:text-text-primary disabled:opacity-50">MAX</button></div>}
              </TradeAmountBox>

              <div className="flex justify-center"><ArrowDown className="size-5 text-text-muted" /></div>

              <TradeAmountBox label={side === "sell" ? "Expected PnL" : "You receive"}>
                {side === "sell" ? (
                  <>
                    <p className={`mt-2 font-financial text-xl ${expectedSellPnl !== undefined && expectedSellPnl >= 0n ? "text-positive" : "text-negative"}`}>
                      {expectedSellPnl === undefined ? "" : `${expectedSellPnl >= 0n ? "+" : "-"}${formatUsd(expectedSellPnl < 0n ? -expectedSellPnl : expectedSellPnl, 2)}`}
                    </p>
                    <p className={`mt-1 font-financial text-[13px] ${expectedSellReturn !== undefined && expectedSellReturn >= 0 ? "text-positive" : "text-negative"}`}>
                      {expectedSellReturn === undefined ? "" : `${expectedSellReturn >= 0 ? "+" : ""}${formatPercent(expectedSellReturn)}`}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 font-financial text-xl text-text-primary">{effectiveQuote ? `≈ ${formatTokenAmount(effectiveQuote)} ${symbol ?? "Token"}` : ""}</p>
                )}
              </TradeAmountBox>

              <div className="grid grid-cols-2 gap-y-2 rounded-md bg-surface-elevated p-3 text-[13px]">
                <DetailRow label="Minimum received" value={effectiveQuote ? `${formatTokenAmount(minAmountOut)} ${side === "buy" ? symbol ?? "Token" : "fUSDC"}` : ""} />
                <DetailRow label="Fee" value={fee ? `${formatTokenAmount(fee)} fUSDC` : ""} />
                <DetailRow label="Protocol" value={protocolFee ? `${formatTokenAmount(protocolFee)} fUSDC` : ""} />
                <DetailRow label="Creator" value={creatorFee ? `${formatTokenAmount(creatorFee)} fUSDC` : ""} />
              </div>

              <Input id="slippage" label="Slippage tolerance" suffix="%" inputMode="decimal" placeholder="1.00" value={slippage} onChange={(event) => setSlippage(event.target.value)} disabled={isLoading} />
              {txError && <p className="text-[13px] text-negative">{txError.message.split("\n")[0]}</p>}
              {!validSlippage && <p className="text-[13px] text-negative">Slippage는 0%에서 100% 사이여야 합니다.</p>}
              {exceedsBalance && <p className="text-[13px] text-negative">잔액이 부족합니다.</p>}
              <Button variant={side === "buy" ? "primary" : "destructive"} className="w-full" onClick={handleTrade} loading={isLoading} disabled={!isConnected || chainId !== ANVIL_CHAIN_ID || !effectiveQuote || !validSlippage || exceedsBalance}>{actionLabel}</Button>
              {!isConnected && <p className="text-center text-[13px] text-text-secondary">거래하려면 지갑을 연결해주세요.</p>}
              {isConnected && chainId !== ANVIL_CHAIN_ID && <p className="text-center text-[13px] text-warning">Anvil 네트워크로 전환해주세요.</p>}
            </div>
          </Card>
        </div>
      ) : (
        <Card><p className="text-sm font-medium text-info">Graduated</p><p className="mt-2 text-sm text-text-secondary">이 토큰은 AMM으로 이전되었습니다. AMM 거래 화면은 아직 제공되지 않습니다.</p></Card>
      )}

      <Card className="mt-6">
        <h2 className="text-[15px] font-semibold text-text-primary">About</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{typeof metadata?.description === "string" ? metadata.description : ""}</p>
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-[13px] font-semibold text-text-primary">Metadata</h3>
          <div className="mt-3 grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)] gap-y-2 text-[13px]">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="contents">
                <span className="truncate pr-4 text-text-secondary">{key}</span>
                <span className="break-all font-financial text-text-primary">{formatMetadataValue(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

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
