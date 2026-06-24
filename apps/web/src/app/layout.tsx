import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { Providers } from "./Providers";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

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
    <html lang="ja" className={notoSansJP.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
