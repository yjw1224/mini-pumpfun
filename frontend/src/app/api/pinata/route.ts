import { NextResponse } from "next/server";

const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return NextResponse.json({ error: "PINATA_JWT가 설정되지 않았습니다." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일이 필요합니다." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
  }

  const pinataFormData = new FormData();
  pinataFormData.append("file", file);
  const response = await fetch(PINATA_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: pinataFormData,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as unknown;
    const message =
      typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : typeof error === "object" && error !== null && "error" in error
          ? JSON.stringify(error.error)
          : "Pinata 업로드에 실패했습니다.";
    return NextResponse.json(
      { error: `[Pinata ${response.status}] ${message}` },
      { status: response.status }
    );
  }

  const result = (await response.json()) as { IpfsHash: string };
  return NextResponse.json({ ipfsHash: result.IpfsHash });
}