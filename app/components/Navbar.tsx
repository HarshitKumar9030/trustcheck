"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
    label: string;
    href: string;
    badge?: React.ReactNode;
    activeClass?: string;
};

const NAV_ITEMS: NavItem[] = [
    { label: "Flagged", href: "/flagged", activeClass: "bg-[rgba(194,65,68,0.08)] text-[rgba(194,65,68,1)] " },
    { label: "Report", href: "/report" },
    { label: "Donate", href: "/donate" },
    { label: "Disclaimer", href: "/disclaimer" },
];

type NavbarProps = {
    subtitle?: string;
    flaggedCount?: number;
};

export function Navbar({ subtitle = "Website trust analysis", flaggedCount }: NavbarProps) {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const isActive = (href: string) => pathname === href;

    return (
        <>
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.9 }}
                className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg)]/80 border-b border-transparent print:hidden"
            >
                <div className="mx-auto max-w-5xl px-5 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-3 group">
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 2 }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                <Image
                                    src="/trustcheck.png"
                                    alt="TrustCheck"
                                    width={36}
                                    height={36}
                                    className="rounded-xl ring-1 ring-[var(--border)] shadow-[0_4px_20px_rgba(17,24,39,0.06)]"
                                />
                            </motion.div>
                            <div>
                                <div className="text-sm font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--brand)] transition-colors">
                                    TrustCheck
                                </div>
                                <div className="text-xs text-[var(--muted)]">{subtitle}</div>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            {NAV_ITEMS.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "relative rounded-full px-3 py-2 text-sm font-medium transition-colors",
                                            active && item.activeClass
                                                ? item.activeClass
                                                : active
                                                    ? "text-[var(--text)] bg-[rgba(17,24,39,0.04)]"
                                                    : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[rgba(17,24,39,0.03)]"
                                        )}
                                    >
                                        <span className="relative z-10 flex items-center gap-2">
                                            {item.label}
                                            {item.label === "Flagged" && typeof flaggedCount === "number" && flaggedCount > 0 && (
                                                <span className="rounded-full border border-[rgba(194,65,68,0.18)] bg-[rgba(194,65,68,0.06)] px-2 py-0.5 text-[11px] font-semibold text-[rgba(194,65,68,1)]">
                                                    {flaggedCount}
                                                </span>
                                            )}
                                        </span>
                                        {active && !item.activeClass && (
                                            <motion.div
                                                layoutId="navbar-indicator"
                                                className="absolute inset-0 rounded-full bg-[rgba(17,24,39,0.04)]"
                                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Mobile Menu Button */}
                        <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden rounded-xl p-2 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[rgba(17,24,39,0.04)] transition-colors"
                            aria-label="Toggle menu"
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                {mobileMenuOpen ? (
                                    <motion.div
                                        key="close"
                                        initial={{ opacity: 0, rotate: -90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: 90 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="menu"
                                        initial={{ opacity: 0, rotate: 90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: -90 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <Menu className="w-5 h-5" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    </div>
                </div>
            </motion.header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
                            onClick={() => setMobileMenuOpen(false)}
                        />

                        {/* Menu Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="fixed top-[73px] left-4 right-4 z-50 md:hidden"
                        >
                            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_20px_60px_rgba(17,24,39,0.15)] overflow-hidden">
                                <nav className="py-2">
                                    {NAV_ITEMS.map((item, index) => {
                                        const active = isActive(item.href);
                                        return (
                                            <motion.div
                                                key={item.href}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05, type: "spring", stiffness: 400, damping: 30 }}
                                            >
                                                <Link
                                                    href={item.href}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className={cn(
                                                        "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors",
                                                        active
                                                            ? "text-[var(--text)] bg-[rgba(17,24,39,0.03)]"
                                                            : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[rgba(17,24,39,0.02)]"
                                                    )}
                                                >
                                                    <span className="flex items-center gap-3">
                                                        {item.label}
                                                        {item.label === "Flagged" && typeof flaggedCount === "number" && flaggedCount > 0 && (
                                                            <span className="rounded-full border border-[rgba(194,65,68,0.18)] bg-[rgba(194,65,68,0.06)] px-2 py-0.5 text-[11px] font-semibold text-[rgba(194,65,68,1)]">
                                                                {flaggedCount}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {active && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]"
                                                        />
                                                    )}
                                                </Link>
                                            </motion.div>
                                        );
                                    })}
                                </nav>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
