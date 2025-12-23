"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export type FluidLoaderProps = {
  size?: number;
  label?: string;
  className?: string;
  tone?: "brand" | "light" | "dark";
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Apple-like “fluid” loader using a gooey metaball filter + gentle motion.
 * Designed to look great on both light and dark backgrounds.
 */
export function Loader({ size = 44, label = "Loading", className, tone = "brand", ...rest }: FluidLoaderProps) {
  const reduceMotion = useReducedMotion();
  const rawId = useId();
  const filterId = `trustcheck-goo-${rawId.replace(/[:]/g, "_")}`;
  const s = clamp(Math.round(size), 16, 160);
  const blur = clamp(s * 0.18, 4, 12);

  const mixBlendMode: React.CSSProperties["mixBlendMode"] = tone === "dark" ? "normal" : "screen";

  const colors =
    tone === "light"
      ? {
          a: "rgba(255,255,255,0.95)",
          b: "rgba(255,255,255,0.80)",
          c: "rgba(255,255,255,0.65)",
          ring: "rgba(255,255,255,0.30)",
          shine: "rgba(255,255,255,0.55)",
        }
      : tone === "dark"
        ? {
            a: "rgba(17,24,39,0.92)",
            b: "rgba(17,24,39,0.75)",
            c: "rgba(17,24,39,0.55)",
            ring: "rgba(17,24,39,0.22)",
            shine: "rgba(17,24,39,0.26)",
          }
        : {
            // Brand-ish (blue → indigo → pink) like modern “Apple-ish” UI motion.
            a: "rgba(47,111,237,0.92)",
            b: "rgba(124,58,237,0.82)",
            c: "rgba(236,72,153,0.70)",
            ring: "rgba(47,111,237,0.22)",
            shine: "rgba(255,255,255,0.55)",
          };

  const duration = 1.4;

  return (
    <div
      role="status"
      aria-label={label}
      className={cn("relative grid place-items-center overflow-visible", className)}
      style={{ width: s, height: s }}
      {...rest}
    >
      {/* SVG filter for the “goo” / metaball look */}
      <svg width={0} height={0} aria-hidden="true" focusable="false">
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      {/* Outer soft ring (subtle Apple-like polish) */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 0 1px ${colors.ring} inset, 0 12px 40px rgba(17,24,39,0.10)`,
        }}
        aria-hidden="true"
      />

      {/* Gooey blobs */}
      <div
        className="absolute inset-0 rounded-full overflow-visible"
        style={{
          filter: `url(#${filterId})`,
        }}
        aria-hidden="true"
      >
        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: s * 0.44,
            height: s * 0.44,
            marginLeft: -(s * 0.22),
            marginTop: -(s * 0.22),
            background: `radial-gradient(circle at 30% 30%, ${colors.shine}, ${colors.a} 45%, rgba(0,0,0,0) 72%)`,
            opacity: 0.95,
          }}
          animate={
            reduceMotion
              ? { opacity: [0.78, 0.95, 0.80] }
              : { x: [-(s * 0.12), s * 0.12, -(s * 0.10)], y: [-(s * 0.10), s * 0.14, -(s * 0.10)], scale: [1, 1.08, 1] }
          }
          transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: s * 0.38,
            height: s * 0.38,
            marginLeft: -(s * 0.19),
            marginTop: -(s * 0.19),
            background: `radial-gradient(circle at 35% 30%, ${colors.shine}, ${colors.b} 50%, rgba(0,0,0,0) 74%)`,
            opacity: 0.92,
          }}
          animate={
            reduceMotion
              ? { opacity: [0.70, 0.92, 0.72] }
              : { x: [s * 0.14, -(s * 0.12), s * 0.10], y: [-(s * 0.02), s * 0.10, -(s * 0.02)], scale: [1, 0.98, 1.06] }
          }
          transition={{ duration: duration * 1.05, repeat: Infinity, ease: "easeInOut", delay: 0.05 }}
        />

        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: s * 0.30,
            height: s * 0.30,
            marginLeft: -(s * 0.15),
            marginTop: -(s * 0.15),
            background: `radial-gradient(circle at 30% 35%, ${colors.shine}, ${colors.c} 55%, rgba(0,0,0,0) 78%)`,
            opacity: 0.88,
          }}
          animate={
            reduceMotion
              ? { opacity: [0.66, 0.88, 0.68] }
              : { x: [-(s * 0.02), s * 0.10, -(s * 0.08)], y: [s * 0.16, -(s * 0.10), s * 0.14], scale: [1.02, 0.98, 1.06] }
          }
          transition={{ duration: duration * 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.12 }}
        />
      </div>

      {/* Center highlight */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: s * 0.64,
          height: s * 0.64,
          background:
            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.40), rgba(255,255,255,0.08) 55%, rgba(255,255,255,0) 75%)",
          opacity: tone === "dark" ? 0.22 : 0.38,
          mixBlendMode,
        }}
        animate={reduceMotion ? { opacity: tone === "dark" ? 0.22 : 0.38 } : { opacity: [0.28, 0.42, 0.30] }}
        transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />

      <span className="sr-only">{label}</span>
    </div>
  );
}

export default Loader;
