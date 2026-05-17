import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "社區好市多代購系統",
  description: "手機版優先的社區團購代購工具"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
