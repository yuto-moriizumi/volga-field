import type { Metadata } from "next";
import { Providers } from "./Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volga Field",
  description: "ゴッドフィールド風のターン制カードバトルRPG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}