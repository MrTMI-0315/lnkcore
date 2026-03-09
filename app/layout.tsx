import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "lnkCore",
  description: "Generate your aesthetic identity poster from a keyword."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
