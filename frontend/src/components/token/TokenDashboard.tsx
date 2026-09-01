"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, CandlestickChart, Copy, LineChart, X } from "lucide-react";
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
import { toGatewayUrl } from "@/lib/ipfs";

const ANVIL_CHAIN_ID = 31337;
const BPS_DENOMINATOR = 10_000n;
const DEFAULT_SLIPPAGE = "1";
const SELL_PERCENTAGES = [10, 25, 50] as const;

type TradeSide = "buy" | "sell";
type ChartMode = "recharts" | "tradingview";

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

export function TokenDashboard({ tokenAddress }: { tokenAddress: string }) {
  const validTokenAddress = isAddress(tokenAddress);
  const token = validTokenAddress ? tokenAddress : undefined;
  const { address: account, isConnected, chainId } = useAccount();
  const [side, setSide] = useState<TradeSide>("buy");
  const [chartMode, setChartMode] = useState<ChartMode>("recharts");
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
  const { data: maxTokenSupply, refetch: refetchMaxTokenSupply } = useReadContract({ address: curveAddress, abi: bondingCurveAbi, functionName: "MAX_TOKEN_SUPPLY", query: { enabled: readEnabled } });
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
    void Promise.all([refetchName(), refetchSymbol(), refetchTokenBalance(), refetchCreator(), refetchVirtualTokenReserve(), refetchVirtualUSDCReserve(), refetchRealTokenReserve(), refetchInitialTokenReserve(), refetchMaxTokenSupply(), refetchUsdcBalance(), refetchUsdcAllowance(), refetchTokenAllowance()]);
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

  const inputAsset = side === "buy" ? "USDC" : symbol ?? "Token";
  const outputAsset = side === "buy" ? symbol ?? "Token" : "USDC";
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
            <Card><div className="grid gap-5 sm:grid-cols-2"><div><p className="text-[13px] text-text-secondary">Price</p><p className="mt-1 font-financial text-2xl text-text-primary">{formatUsd(price)}</p></div><div><p className="text-[13px] text-text-secondary">Market Cap</p><p className="mt-1 font-financial text-2xl text-text-primary">{formatUsd((price * (maxTokenSupply ?? 0n)) / 10n ** 18n, 0)}</p></div></div></Card>
            <Card><div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold text-text-primary">Price chart</h2><div className="flex gap-1"><button type="button" title="Recharts chart" onClick={() => setChartMode("recharts")} className={`flex size-8 items-center justify-center rounded-md ${chartMode === "recharts" ? "bg-surface-elevated text-primary" : "text-text-secondary hover:text-text-primary"}`}><LineChart className="size-4" /></button><button type="button" title="TradingView chart" onClick={() => setChartMode("tradingview")} className={`flex size-8 items-center justify-center rounded-md ${chartMode === "tradingview" ? "bg-surface-elevated text-primary" : "text-text-secondary hover:text-text-primary"}`}><CandlestickChart className="size-4" /></button></div></div><div className="mt-4 flex h-64 items-center justify-center border-y border-border text-[13px] text-text-muted">{chartMode === "recharts" ? "" : ""}</div></Card>
            <Card><div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold text-text-primary">Bonding Curve Progress</h2><span className="font-financial text-sm text-primary">{formatPercent(progress)}</span></div><Progress ratio={progress} className="mt-4" /><div className="mt-3 flex justify-between text-[13px] text-text-secondary"><span>{formatTokenAmount((initialTokenReserve ?? 0n) - (realTokenReserve ?? 0n), 0)} / {formatTokenAmount(initialTokenReserve ?? 0n, 0)} tokens sold</span><span>Graduation at 100%</span></div></Card>
          </div>
          <Card className="h-fit"><div className="grid grid-cols-2 border-b border-border"><button type="button" onClick={() => { setSide("buy"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "buy" ? "border-b-2 border-primary text-primary" : "text-text-secondary"}`}>Buy {symbol}</button><button type="button" onClick={() => { setSide("sell"); setAmount(""); }} className={`pb-3 text-sm font-semibold ${side === "sell" ? "border-b-2 border-negative text-negative" : "text-text-secondary"}`}>Sell {symbol}</button></div><div className="mt-5 space-y-4"><Input id="trade-amount" label="You pay" suffix={inputAsset} inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isLoading} />{isConnected && <p className="-mt-2 text-[12px] text-text-secondary">Balance: {side === "buy" ? `${formatTokenAmount(usdcBalance ?? 0n)} Test USDC` : `${formatTokenAmount(tokenBalance ?? 0n)} ${symbol}`}</p>}{side === "sell" && isConnected && <div className="flex justify-end gap-1">{SELL_PERCENTAGES.map((percentage) => <button key={percentage} type="button" onClick={() => setSellPercentage(percentage)} disabled={isLoading || !tokenBalance} className="h-7 rounded-sm border border-border-strong px-2 font-financial text-text-secondary hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50">{percentage}%</button>)}<button type="button" onClick={() => setSellPercentage(100)} disabled={isLoading || !tokenBalance} className="h-7 rounded-sm border border-border-strong px-2 font-financial text-text-secondary hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50">MAX</button></div>}<div className="flex justify-center"><ArrowDown className="size-5 text-text-muted" /></div><div className="rounded-md border border-border bg-surface-elevated p-3 text-[13px]"><p className="text-text-secondary">You receive</p><p className="mt-1 font-financial text-xl text-text-primary">{quote ? `≈ ${formatTokenAmount(quote)} ${outputAsset}` : ""}</p></div><div className="rounded-md bg-surface-elevated p-3 text-[13px]"><div className="flex justify-between"><span className="text-text-secondary">Minimum received</span><span className="font-financial text-text-primary">{quote ? `${formatTokenAmount(minAmountOut)} ${outputAsset}` : ""}</span></div></div><Input id="slippage" label="Slippage tolerance" suffix="%" inputMode="decimal" placeholder="1.00" value={slippage} onChange={(event) => setSlippage(event.target.value)} disabled={isLoading} /><div className="grid grid-cols-2 gap-y-2 text-[13px]"><span className="text-text-secondary">Fee</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(fee)} {inputAsset}</span><span className="text-text-secondary">Protocol</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(protocolFee)} {inputAsset}</span><span className="text-text-secondary">Creator</span><span className="text-right font-financial text-text-primary">{formatTokenAmount(creatorFee)} {inputAsset}</span></div>{txError && <p className="text-[13px] text-negative">{txError.message.split("\n")[0]}</p>}{!validSlippage && <p className="text-[13px] text-negative">Slippage는 0%에서 100% 사이여야 합니다.</p>}<Button variant={side === "buy" ? "primary" : "destructive"} className="w-full" onClick={handleTrade} loading={isLoading} disabled={!isConnected || chainId !== ANVIL_CHAIN_ID || !quote || !validSlippage}>{actionLabel}</Button>{!isConnected && <p className="text-center text-[13px] text-text-secondary">거래하려면 지갑을 연결해주세요.</p>}{isConnected && chainId !== ANVIL_CHAIN_ID && <p className="text-center text-[13px] text-warning">Anvil 네트워크로 전환해주세요.</p>}</div></Card>
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