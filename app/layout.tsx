import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "./lib/store";

export const metadata: Metadata = {
  title: "看看收藏",
  description: "小红书收藏沉淀",
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
