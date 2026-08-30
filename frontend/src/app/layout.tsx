import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Mini Pump",
  description: "Bonding curve meme token trading on Sepolia",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
