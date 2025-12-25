"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Home, ArrowLeft, Search, Settings } from "lucide-react";

// Animated Cog Component
// Animated Cog Component (using Lucide Settings icon for cleaner aesthetic)
function Cog({ size = 80, className = "", speed = 8, reverse = false }: {
    size?: number;
    className?: string;
    speed?: number;
    reverse?: boolean;
}) {
    return (
        <motion.div
            className={`inline-flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
            animate={{ rotate: reverse ? -360 : 360 }}
            transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
        >
            <Settings width={size} height={size} strokeWidth={1} />
        </motion.div>
    );
}

export default function NotFoundPage() {
    return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6 overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />

            {/* Floating Cogs Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <Cog
                    size={120}
                    className="absolute top-[10%] left-[5%] text-[var(--border)] opacity-40"
                    speed={12}
                />
                <Cog
                    size={80}
                    className="absolute top-[5%] left-[15%] text-[var(--border)] opacity-30"
                    speed={8}
                    reverse
                />
                <Cog
                    size={60}
                    className="absolute bottom-[15%] right-[8%] text-[var(--border)] opacity-35"
                    speed={10}
                />
                <Cog
                    size={100}
                    className="absolute bottom-[20%] right-[18%] text-[var(--border)] opacity-25"
                    speed={14}
                    reverse
                />
                <Cog
                    size={40}
                    className="absolute top-[40%] right-[5%] text-[var(--border)] opacity-20"
                    speed={6}
                />
            </div>

            {/* Main Content */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative z-10 text-center max-w-lg"
            >
                {/* Animated Cogs Cluster */}
                <div className="relative w-48 h-48 mx-auto mb-8">
                    <Cog
                        size={100}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--brand)]"
                        speed={6}
                    />
                    <Cog
                        size={50}
                        className="absolute top-[15%] right-[10%] text-[var(--muted)]"
                        speed={4}
                        reverse
                    />
                    <Cog
                        size={40}
                        className="absolute bottom-[20%] left-[15%] text-[var(--muted)]"
                        speed={5}
                    />
                </div>

                {/* Error Code */}
                <motion.h1
                    className="text-8xl font-bold text-[var(--text)] tracking-tight"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                    404
                </motion.h1>

                <motion.p
                    className="text-xl text-[var(--muted)] mt-4 mb-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    Page not found
                </motion.p>

                <motion.p
                    className="text-sm text-[var(--muted)] max-w-sm mx-auto mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    The page you're looking for doesn't exist or has been moved.
                    Let's get you back on track.
                </motion.p>

                {/* Action Buttons */}
                <motion.div
                    className="flex flex-col sm:flex-row gap-3 justify-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold hover:bg-[var(--brand-ink)] transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        Go Home
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm font-medium hover:bg-[rgba(17,24,39,0.03)] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
}
