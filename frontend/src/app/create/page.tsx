"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog } from "viem";
import { Upload } from "lucide-react";
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
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
        router.push(`/token/${decoded.args.token}?created=1`);
        return;
      } catch {
        // not a TokenCreated log, keep scanning
      }
    }
  }, [receipt, router]);

  async function uploadToPinata(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/pinata", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as { error?: string; ipfsHash?: string };

    if (!response.ok || !result.ipfsHash) {
      throw new Error(result.error ?? "Pinata 업로드에 실패했습니다.");
    }

    return `ipfs://${result.ipfsHash}`;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim() || !symbol.trim() || !description.trim() || !image) {
      setFormError("Name, Symbol, Description, Image를 모두 입력해주세요.");
      return;
    }

    try {
      setIsUploading(true);
      const imageUri = await uploadToPinata(image);
      const metadata = new File(
        [JSON.stringify({ name: name.trim(), symbol: symbol.trim(), description: description.trim(), image: imageUri })],
        "metadata.json",
        { type: "application/json" }
      );
      const tokenUri = await uploadToPinata(metadata);

      writeContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "createToken",
        args: [name.trim(), symbol.trim(), tokenUri],
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "메타데이터 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  const isSubmitting = isUploading || isSigning || isConfirming;
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-[13px] font-medium text-text-secondary">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              placeholder="A cute meme token on Mini Pump."
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-surface px-3 py-3 text-[15px] text-text-primary outline-none placeholder:text-text-muted focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="image" className="text-[13px] font-medium text-text-secondary">
              Image
            </label>
            <label className="flex h-12 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-[15px] text-text-secondary hover:border-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
              <Upload className="size-4 shrink-0" />
              <span className="truncate">{image?.name ?? "Upload image"}</span>
              <input
                id="image"
                type="file"
                accept="image/*"
                disabled={isSubmitting}
                className="sr-only"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-surface-elevated p-3 text-[13px]">
            <span className="text-text-secondary">Initial MCap</span>
            <span className="text-right font-financial text-text-primary">
              $1,000
            </span>
            <span className="text-text-secondary">Graduation MCap</span>
            <span className="text-right font-financial text-text-primary">
              $100,000
            </span>
            <span className="text-text-secondary">Total Supply</span>
            <span className="text-right font-financial text-text-primary">
              10,000,000 tokens
            </span>
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
              9,000,000 tokens
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
                : isUploading
                  ? "Uploading metadata..."
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
