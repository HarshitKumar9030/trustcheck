"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, Loader2, Check, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/app/components/Navbar";

export default function ReportScamPage() {
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        url: "",
        category: "Phishing",
        description: "",
        evidence: "",
    });

    const categories = [
        "Phishing",
        "Shopping Scam",
        "Investment Scam",
        "Tech Support",
        "Identity Theft",
        "Other",
    ];

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Simulated delay for feel
        await new Promise(r => setTimeout(r, 600));

        try {
            const res = await fetch("/api/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Something went wrong.");
            }

            setSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit report");
        } finally {
            setLoading(false);
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen grid place-items-center bg-[#F4F5F8] p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-md bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-12 text-center"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="w-16 h-16 bg-[#5E6AD2]/10 text-[#5E6AD2] rounded-full mx-auto grid place-items-center mb-6"
                    >
                        <Check className="w-8 h-8" strokeWidth={2.5} />
                    </motion.div>
                    <h2 className="text-xl font-medium text-gray-900 mb-2">Report Sent</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed text-sm">
                        Thank you. We've queued this URL for analysis.
                    </p>
                    <div className="space-y-3">
                        <Link
                            href="/"
                            className="block w-full py-2.5 rounded-lg bg-[#5E6AD2] text-white text-sm font-medium hover:bg-[#4b55be] transition-colors shadow-sm"
                        >
                            Analyze Another URL
                        </Link>
                        <button
                            onClick={() => {
                                setSubmitted(false);
                                setFormData({ url: "", category: "Phishing", description: "", evidence: "" });
                            }}
                            className="block w-full py-2.5 rounded-lg text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Submit New Report
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            <Navbar subtitle="Report a scam" />
            <div className="flex flex-col items-center py-12 sm:py-16 px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-[480px]"
                >

                    <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden ring-1 ring-gray-950/5">
                        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
                            <h1 className="text-xl font-semibold text-gray-900">
                                Report Suspicious Activity
                            </h1>
                            <p className="text-sm text-gray-500 mt-2">
                                Help us improve our detection by reporting scams.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-5">
                                <div className="group relative">
                                    <label
                                        htmlFor="url"
                                        className={cn(
                                            "absolute left-3 transition-all duration-200 pointer-events-none text-gray-500 px-1 bg-white",
                                            formData.url || focusedField === "url"
                                                ? "-top-2.5 text-xs font-medium text-[#5E6AD2]"
                                                : "top-2.5 text-sm"
                                        )}
                                    >
                                        Website URL
                                    </label>
                                    <input
                                        id="url"
                                        type="url"
                                        required
                                        value={formData.url}
                                        onFocus={() => setFocusedField("url")}
                                        onBlur={() => setFocusedField(null)}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-transparent focus:border-[#5E6AD2] focus:ring-4 focus:ring-[#5E6AD2]/10"
                                    />
                                </div>

                                <div className="relative">
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">
                                        CATEGORY
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="category"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#5E6AD2] focus:ring-4 focus:ring-[#5E6AD2]/10"
                                        >
                                            {categories.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="group relative">
                                    <label
                                        htmlFor="description"
                                        className={cn(
                                            "absolute left-3 transition-all duration-200 pointer-events-none text-gray-500 px-1 bg-white",
                                            formData.description || focusedField === "description"
                                                ? "-top-2.5 text-xs font-medium text-[#5E6AD2]"
                                                : "top-2.5 text-sm"
                                        )}
                                    >
                                        Description
                                    </label>
                                    <textarea
                                        id="description"
                                        rows={3}
                                        value={formData.description}
                                        onFocus={() => setFocusedField("description")}
                                        onBlur={() => setFocusedField(null)}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-transparent resize-none focus:border-[#5E6AD2] focus:ring-4 focus:ring-[#5E6AD2]/10"
                                    />
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="rounded-lg bg-red-50 p-3 flex items-start gap-3"
                                >
                                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                    <p className="text-sm text-red-600 font-medium">{error}</p>
                                </motion.div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="relative w-full overflow-hidden rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-900/10 disabled:opacity-70 disabled:pointer-events-none"
                            >
                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            Submit Report
                                            <ArrowRight className="w-4 h-4 opacity-50" />
                                        </>
                                    )}
                                </div>
                            </button>

                            <p className="text-center text-xs text-gray-400 mt-4">
                                Protected by TrustCheck Security
                            </p>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
