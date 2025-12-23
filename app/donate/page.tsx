import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DonateClient } from "@/app/donate/DonateClient";

export const metadata: Metadata = {
  title: "Donate • TrustCheck",
  description: "Support TrustCheck development via card, crypto, or UPI.",
};

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
      <header className="mx-auto max-w-5xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/trustcheck.png"
              alt="TrustCheck"
              width={36}
              height={36}
              className="rounded-xl ring-1 ring-[var(--border)] shadow-[0_8px_30px_rgba(17,24,39,0.06)]"
            />
            <div>
              <div className="text-sm font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--brand)] transition-colors">
                TrustCheck
              </div>
              <div className="text-xs text-[var(--muted)]">AI-Powered Trust Analysis</div>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <a
              href="/flagged"
              className="rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            >
              Flagged
            </a>
            <a
              href="/donate"
              aria-current="page"
              className="rounded-full bg-[rgba(47,111,237,0.10)] px-3 py-2 text-sm font-medium text-[var(--brand)] ring-1 ring-[rgba(47,111,237,0.18)]"
            >
              Donate
            </a>
            <a
              href="/disclaimer"
              className="rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            >
              Disclaimer
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="pt-10 sm:pt-14">
          <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)]">
            <div className="px-6 py-10 sm:px-10 sm:py-12">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
                  Support TrustCheck
                </h1>
                <p className="mt-3 text-pretty text-base leading-7 text-[var(--muted)] sm:text-lg">
                  TrustCheck is self-funded. Donations help cover hosting, crawling, and AI inference costs.
                </p>
              </div>

              <div className="mx-auto mt-8 max-w-3xl">
                <DonateClient config={config} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-10">
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
