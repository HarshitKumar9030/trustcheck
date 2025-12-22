"use client";

import { motion, useAnimate } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void;
  icon?: ReactNode;
  label?: string;
}

export function AnimatedActionButton({
  className,
  children,
  icon,
  label,
  onClick,
  disabled,
  ...rest
}: AnimatedActionButtonProps) {
  const [scope, animate] = useAnimate();
  const [showIndicator, setShowIndicator] = useState(false);

  const animateLoading = async () => {
    await animate(
      ".check",
      { opacity: 0, scale: 1, display: "none" },
      { duration: 0.1, ease: "easeOut" }
    );
    await animate(
      ".loader",
      { opacity: 1, scale: 1, display: "block" },
      { duration: 0.15, ease: "easeOut" }
    );
  };

  const animateSuccess = async () => {
    await animate(
      ".loader",
      { opacity: 0, scale: 0.85, display: "none" },
      { duration: 0.15, ease: "easeOut" }
    );
    await animate(
      ".check",
      { opacity: 1, scale: 1, display: "block" },
      { duration: 0.15, ease: "easeOut" }
    );
    await animate(
      ".checkPath",
      { pathLength: 1, opacity: 1 },
      { duration: 0.22, ease: "easeOut" }
    );
    await animate(
      ".check",
      { opacity: 0, scale: 1, display: "none" },
      { delay: 1.2, duration: 0.15, ease: "easeOut" }
    );
  };

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    setShowIndicator(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await animateLoading();
    try {
      await onClick?.(event);
      await animateSuccess();
      setShowIndicator(false);
    } catch (err) {
      // fall back to idle state on error
      await animate(
        ".loader",
        { opacity: 0, scale: 0.85, display: "none" },
        { duration: 0.15, ease: "easeOut" }
      );
      await animate(
        ".check",
        { opacity: 0, scale: 0.9, display: "none" },
        { duration: 0.15, ease: "easeOut" }
      );
      setShowIndicator(false);
      throw err;
    }
  };

  return (
    <motion.button
      ref={scope}
      type="button"
      disabled={disabled}
      className={cn(
        "flex min-w-[140px] items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-ink)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[var(--ring)]",
        className
      )}
      onClick={handleClick}
      {...(rest as any)}
    >
      <span className="flex items-center gap-2">
        {showIndicator ? (
          <span className="relative h-5 w-5" aria-hidden="true">
            <Loader />
            <CheckIcon />
          </span>
        ) : null}
        {icon ? <span className="h-4 w-4 text-white" aria-hidden="true">{icon}</span> : null}
        <span>{label ?? children}</span>
      </span>
    </motion.button>
  );
}

function Loader() {
  return (
    <motion.svg
      animate={{ rotate: [0, 360] }}
      initial={{ opacity: 0, scale: 0.85, display: "none" }}
      style={{ opacity: 0, scale: 0.85, display: "none" }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="loader absolute inset-0 h-5 w-5 text-white"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M12 3a9 9 0 1 0 9 9" />
    </motion.svg>
  );
}

function CheckIcon() {
  return (
    <motion.svg
      initial={{ opacity: 0, scale: 0.9, display: "none" }}
      style={{ opacity: 0, scale: 0.9, display: "none" }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="check absolute inset-0 h-5 w-5 text-white"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <motion.path
        className="checkPath"
        d="M6.5 12.5l3.2 3.2L17.5 8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        style={{ pathLength: 0, opacity: 0 }}
      />
    </motion.svg>
  );
}
