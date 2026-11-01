import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "まいにちの台所 | 家族の献立と買い物リスト",
  description:
    "わが家のレシピ、今週の献立、お店ごとの買い物リストをひとつに。家族のための献立ノート。",
  applicationName: "まいにちの台所",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "まいにちの台所",
  },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f9f5",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <a href="#main-content" className="skip-link">
          本文へ移動
        </a>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
