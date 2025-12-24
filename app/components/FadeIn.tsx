"use client";

import { motion, type MotionProps } from "framer-motion";
import type { ReactNode } from "react";

type FadeInProps = MotionProps & {
  children: ReactNode;
  delay?: number;
  y?: number;
};

export function FadeIn({ children, delay = 0, y = 10, ...rest }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.9, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
