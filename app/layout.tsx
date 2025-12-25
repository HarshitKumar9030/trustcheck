import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PageLoadGate } from "@/app/components/PageLoadGate";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ScamCheck",
  description: "Automated trust analysis based on public signals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <PageLoadGate minMs={1100} />
        {children}
      </body>
    </html>
  );
}
