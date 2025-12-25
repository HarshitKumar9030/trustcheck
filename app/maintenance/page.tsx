"use client";

import { motion } from "framer-motion";
import { Settings, Twitter, Mail } from "lucide-react";

export default function MaintenancePage() {
    return (
        <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="text-[var(--border)] mb-8"
            >
                <Settings className="w-16 h-16" strokeWidth={1} />
            </motion.div>

            <h1 className="text-2xl font-semibold text-[var(--text)] tracking-tight mb-3">
                Under Maintenance
            </h1>

            <p className="text-[var(--muted)] text-center max-w-sm mb-2">
                We're upgrading our systems to serve you better.
            </p>
            <p className="text-[var(--muted)] text-center text-sm max-w-sm">
                Expected downtime is minimal. Follow us for real-time updates.
            </p>

            <div className="mt-8 flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand)]"></span>
                </span>
                Working on it
            </div>

            <div className="mt-10 flex items-center gap-6">
                <a
                    href="https://twitter.com/scamchecktech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                    <Twitter className="w-4 h-4" />
                    @scamchecktech
                </a>
                <a
                    href="mailto:support@scamcheck.tech"
                    className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                    <Mail className="w-4 h-4" />
                    Contact
                </a>
            </div>
        </div>
    );
}
