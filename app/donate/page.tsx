"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { DonateClient } from "@/app/donate/DonateClient";
import { NavbarWrapper } from "@/app/components/NavbarWrapper";

export default function DonatePage() {
  const config = {
    cardUrl: process.env.NEXT_PUBLIC_DONATE_CARD_URL ?? "",
    cryptoUrl: process.env.NEXT_PUBLIC_DONATE_CRYPTO_URL ?? "",
    upiId: process.env.NEXT_PUBLIC_DONATE_UPI_ID ?? "",
    upiName: process.env.NEXT_PUBLIC_DONATE_UPI_NAME ?? "TrustCheck",
    cryptoAddresses: {
      BTC: process.env.NEXT_PUBLIC_DONATE_BTC ?? "",
      ETH: process.env.NEXT_PUBLIC_DONATE_ETH ?? "",
      SOL: process.env.NEXT_PUBLIC_DONATE_SOL ?? "",
      USDT: process.env.NEXT_PUBLIC_DONATE_USDT ?? "",
    },
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavbarWrapper subtitle="Support TrustCheck" />

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)] px-8 py-10 sm:px-12 sm:py-14"
        >
          <div className="text-center mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl mb-3">
              Support TrustCheck
            </h1>
            <p className="text-[var(--muted)] leading-relaxed max-w-lg mx-auto">
              TrustCheck is self-funded. Your support helps cover hosting, crawling, and AI inference costs.
            </p>
          </div>

          <DonateClient config={config} />
        </motion.div>
      </main>

      <footer className="mx-auto max-w-3xl px-5 pb-10">
        <div className="flex flex-col gap-1 text-xs text-[rgba(17,24,39,0.45)]">
          <span>Thank you for keeping TrustCheck running.</span>
          <a
            href="https://trustcheck.agfe.tech"
            target="_blank"
            rel="noreferrer"
            className="w-fit text-[rgba(47,111,237,0.85)] hover:text-[rgba(47,111,237,1)]"
          >
            trustcheck.agfe.tech
          </a>
        </div>
      </footer>
    </div>
  );
}
