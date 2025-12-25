"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { NavbarWrapper } from "@/app/components/NavbarWrapper";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavbarWrapper subtitle="Disclaimer" />

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)] px-8 py-10 sm:px-12 sm:py-14"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl mb-10">
            Disclaimer
          </h1>

          <div className="space-y-10 text-[15px] leading-7 text-[var(--muted)]">
            <section>
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-3">Purpose</h2>
              <p>
                ScamCheck helps you make more informed decisions when visiting unfamiliar websites.
                It summarizes publicly observable signals and presents a structured report to support your own judgment.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-3">How It Works</h2>
              <ul className="list-disc pl-5 space-y-2 marker:text-gray-400">
                <li><strong className="text-[var(--text)] font-medium">Connection & TLS:</strong> Checks for HTTPS and certificate validity.</li>
                <li><strong className="text-[var(--text)] font-medium">Domain Age:</strong> Queries RDAP/WHOIS to estimate registration age.</li>
                <li><strong className="text-[var(--text)] font-medium">Fetch & Redirects:</strong> Records status codes and redirect chains.</li>
                <li><strong className="text-[var(--text)] font-medium">On-page Signals:</strong> Looks for contact info, privacy policies, and business cues.</li>
                <li><strong className="text-[var(--text)] font-medium">Security Headers:</strong> Checks for modern security headers.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-3">No Claims & Limitations</h2>
              <div className="space-y-4">
                <p>
                  This tool does not make any legal, factual, or definitive claims about any website.
                  The trust score and notes are automated and may be incomplete, outdated, or inaccurate.
                </p>
                <p>
                  A high score does not guarantee safety, and a low score does not imply danger.
                  Automated checks cannot detect all risks (malware, phishing, specific frauds).
                  <strong> Always use your own judgment.</strong>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-3">Privacy</h2>
              <p>
                We analyze only publicly accessible website content and metadata. We do not ask for
                personal data. Submitted URLs may be cached temporarily for performance.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-3">Models Used</h2>
              <p>
                ScamCheck may use <strong>Gemini 2.5 Flash</strong> as part of producing summaries and structured assessments.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-[var(--border)]">
            <Link
              href="/"
              className="group inline-flex items-center text-sm font-medium text-[var(--text)] hover:text-[var(--brand)] transition-colors"
            >
              <svg className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Return to ScamCheck
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="mx-auto max-w-3xl px-5 pb-10">
        <div className="flex flex-col gap-1 text-xs text-[rgba(17,24,39,0.45)]">
          <span>Designed to help you think clearly, not to accuse.</span>
          <a
            href="https://scamcheck.tech"
            target="_blank"
            rel="noreferrer"
            className="w-fit text-[rgba(47,111,237,0.85)] hover:text-[rgba(47,111,237,1)]"
          >
            scamcheck.tech
          </a>
        </div>
      </footer>
    </div>
  );
}
