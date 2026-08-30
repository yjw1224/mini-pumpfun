"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseUnits, decodeEventLog } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FACTORY_ADDRESS, factoryAbi } from "@/lib/contracts";

export default function CreateTokenPage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [initialPrice, setInitialPrice] = useState("1.0");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    writeContract,
    data: hash,
    isPending: isSigning,
    error: writeError,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!receipt) return;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: factoryAbi,
          eventName: "TokenCreated",
          data: log.data,
          topics: log.topics,
        });
        router.push(`/token/${decoded.args.token}`);
        return;
      } catch {
        // not a TokenCreated log, keep scanning
      }
    }
  }, [receipt, router]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim() || !symbol.trim()) {
      setFormError("Name과 Symbol을 입력해주세요.");
      return;
    }

    let parsedPrice: bigint;
    try {
      parsedPrice = parseUnits(initialPrice || "0", 18);
    } catch {
      setFormError("Initial Price 형식이 올바르지 않습니다.");
      return;
    }
    if (parsedPrice <= 0n) {
      setFormError("Initial Price는 0보다 커야 합니다.");
      return;
    }

    writeContract({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: "createToken",
      args: [name.trim(), symbol.trim(), parsedPrice],
    });
  }

  const isSubmitting = isSigning || isConfirming;
  const txError = writeError ?? receiptError;

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        Create Token
      </h1>

      <Card className="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="name"
            label="Token Name"
            placeholder="My Meme Token"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
          />
          <Input
            id="symbol"
            label="Symbol"
            placeholder="MEME"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            disabled={isSubmitting}
          />
          <Input
            id="initialPrice"
            label="Initial Price"
            type="number"
            step="any"
            min="0"
            suffix="USDC"
            value={initialPrice}
            onChange={(event) => setInitialPrice(event.target.value)}
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-surface-elevated p-3 text-[13px]">
            <span className="text-text-secondary">Fee</span>
            <span className="text-right font-financial text-text-primary">
              1%
            </span>
            <span className="text-text-secondary">Protocol</span>
            <span className="text-right font-financial text-text-primary">
              0.7%
            </span>
            <span className="text-text-secondary">Creator</span>
            <span className="text-right font-financial text-text-primary">
              0.3%
            </span>
            <span className="text-text-secondary">Real Token Reserve</span>
            <span className="text-right font-financial text-text-primary">
              800,000 tokens
            </span>
          </div>

          {formError && <p className="text-[13px] text-negative">{formError}</p>}
          {txError && (
            <p className="text-[13px] text-negative">
              {txError.message.split("\n")[0]}
            </p>
          )}
          {!FACTORY_ADDRESS && (
            <p className="text-[13px] text-warning">
              NEXT_PUBLIC_FACTORY_ADDRESS가 설정되지 않았습니다.
            </p>
          )}

          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!isConnected || !FACTORY_ADDRESS}
          >
            {isSigning
              ? "Confirm in wallet..."
              : isConfirming
                ? "Transaction pending..."
                : "Create Token"}
          </Button>
          {!isConnected && (
            <p className="text-center text-[13px] text-text-secondary">
              토큰을 생성하려면 지갑을 연결해주세요.
            </p>
          )}
        </form>
      </Card>
    </AppShell>
  );
}
