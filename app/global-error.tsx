"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Home, RefreshCcw, AlertCircle, Settings } from "lucide-react";
import { useEffect } from "react";

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

// Pulsing Alert Icon
function PulsingAlert() {
    return (
        <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
        >
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
        </motion.div>
    );
}

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Application error:", error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6 overflow-hidden">
                    {/* Floating Cogs Background */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <Cog
                            size={100}
                            className="absolute top-[8%] left-[8%] text-gray-200 opacity-50"
                            speed={10}
                        />
                        <Cog
                            size={60}
                            className="absolute top-[15%] left-[18%] text-gray-200 opacity-40"
                            speed={7}
                            reverse
                        />
                        <Cog
                            size={80}
                            className="absolute bottom-[10%] right-[10%] text-gray-200 opacity-45"
                            speed={12}
                        />
                        <Cog
                            size={50}
                            className="absolute bottom-[25%] right-[20%] text-gray-200 opacity-35"
                            speed={8}
                            reverse
                        />
                    </div>

                    {/* Main Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="relative z-10 text-center max-w-lg"
                    >
                        {/* Animated Cogs with Alert Center */}
                        <div className="relative w-48 h-48 mx-auto mb-8">
                            <Cog
                                size={90}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-400"
                                speed={8}
                            />
                            <Cog
                                size={45}
                                className="absolute top-[10%] right-[5%] text-gray-400"
                                speed={5}
                                reverse
                            />
                            <Cog
                                size={35}
                                className="absolute bottom-[15%] left-[10%] text-gray-400"
                                speed={6}
                            />
                            <PulsingAlert />
                        </div>

                        {/* Error Code */}
                        <motion.h1
                            className="text-7xl font-bold text-gray-900 tracking-tight"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        >
                            500
                        </motion.h1>

                        <motion.p
                            className="text-xl text-gray-600 mt-4 mb-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Something went wrong
                        </motion.p>

                        <motion.p
                            className="text-sm text-gray-500 max-w-sm mx-auto mb-8"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            We encountered an unexpected error. Our team has been notified and
                            is working on a fix. Please try again.
                        </motion.p>

                        {/* Action Buttons */}
                        <motion.div
                            className="flex flex-col sm:flex-row gap-3 justify-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <button
                                onClick={() => reset()}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Try Again
                            </button>
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </Link>
                        </motion.div>

                        {/* Error ID */}
                        {error.digest && (
                            <motion.p
                                className="mt-8 text-xs text-gray-400 font-mono"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                Error ID: {error.digest}
                            </motion.p>
                        )}
                    </motion.div>
                </div>
            </body>
        </html>
    );
}
