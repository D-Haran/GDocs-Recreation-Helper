"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type CategoryFilterProps<T extends string> = {
  options: Array<FilterOption<T>>;
  active: T;
  onChange: (value: T) => void;
  ariaLabel: string;
};

export function CategoryFilter<T extends string>({ options, active, onChange, ariaLabel }: CategoryFilterProps<T>) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-wrap gap-2" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <motion.button
            key={option.value}
            type="button"
            whileHover={reduceMotion ? undefined : { y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "border-accent bg-accent text-white shadow-sm dark:text-slate-950"
                : "border-line bg-surface text-muted-strong hover:border-accent-border hover:bg-accent-soft hover:text-accent-strong",
            )}
          >
            {option.label}
          </motion.button>
        );
      })}
    </div>
  );
}
