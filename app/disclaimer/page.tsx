import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Disclaimer - TrustCheck",
  description: "Important information about how TrustCheck works and its limitations.",
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 group"
          >
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
              <div className="text-xs text-[var(--muted)]">Website trust analysis</div>
            </div>
          </Link>
          
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16">
        <div className="rounded-3xl bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow)] px-6 py-10 sm:px-10 sm:py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
            Disclaimer
          </h1>

          <div className="mt-8 space-y-6 text-[15px] leading-7 text-[var(--muted)]">
            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">Purpose of This Tool</h2>
              <p className="mt-2">
                TrustCheck helps you make more informed decisions when visiting unfamiliar websites.
                It summarizes publicly observable signals and presents a structured report to support your own judgment.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">How It Works</h2>
              <ul className="mt-2 list-disc pl-5 space-y-2">
                <li>
                  <strong>Connection & TLS:</strong> We check whether HTTPS is used and capture basic certificate signals.
                </li>
                <li>
                  <strong>Domain Age:</strong> We query public RDAP/WHOIS sources (when available) to estimate registration age.
                </li>
                <li>
                  <strong>Fetch & Redirects:</strong> We record HTTP status, content type, and redirect behavior.
                </li>
                <li>
                  <strong>On-page Signals:</strong> We look for common trust signals like contact/support information, business identity cues, and policy pages.
                </li>
                <li>
                  <strong>Security Headers:</strong> We check for modern security-related HTTP headers when provided.
                </li>
                <li>
                  <strong>Multi-page Sampling:</strong> When possible, we sample multiple internal pages to reduce homepage-only bias.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">No Legal or Factual Claims</h2>
              <p className="mt-2">
                This tool does not make any legal, factual, or definitive claims about any website.
                The trust score and notes are automated and may be incomplete, outdated, or inaccurate.
                We intentionally use neutral language and avoid accusatory terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">Limitations</h2>
              <ul className="mt-2 list-disc pl-5 space-y-2">
                <li>
                  Domain age information relies on public RDAP/WHOIS data, which is not always available or accurate.
                </li>
                <li>
                  Homepage content analysis may be blocked by certain websites, bot protection, or security measures.
                </li>
                <li>
                  A high score does not guarantee a website is safe; a low score does not mean a
                  website is dangerous.
                </li>
                <li>
                  Well-known brands may receive favorable treatment even when content cannot be fetched.
                </li>
                <li>
                  Automated pattern checks may not catch all risks and can misinterpret signals.
                </li>
                <li>
                  This tool cannot detect all forms of risk, including but not limited to: malware,
                  phishing, data breaches, or financial fraud.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">Privacy</h2>
              <p className="mt-2">
                We analyze only publicly accessible website content and metadata. We do not ask for your personal data.
                Submitted URLs may be cached temporarily to improve performance.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">Use Your Own Judgment</h2>
              <p className="mt-2">
                Always exercise your own judgment and conduct additional research before sharing
                personal information, making purchases, or trusting any website. This tool is meant
                to assist your decision-making process, not replace it. When in doubt, consult
                official sources or trusted security professionals.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">No Liability</h2>
              <p className="mt-2">
                The creators of TrustCheck accept no liability for any decisions made based on the
                information provided by this tool. Use at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-[var(--text)]">Models Used</h2>
              <p className="mt-2">
                TrustCheck may use the following model as part of producing summaries and structured assessments:
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-2">
                <li>
                  <strong>Gemini 3 Flash</strong>
                </li>
              </ul>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--border)]">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            >
              Return to TrustCheck
            </Link>
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-3xl px-5 pb-10">
        <div className="flex flex-col gap-1 text-xs text-[rgba(17,24,39,0.45)]">
          <span>Designed to help you think clearly, not to accuse.</span>
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
