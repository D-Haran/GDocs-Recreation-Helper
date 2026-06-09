"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import type { ObjectRoute } from "@/data/routes";
import { objectCategoryLabels } from "@/data/routes";
import { ObjectVisual } from "@/components/ObjectVisual";

export function ObjectCard({ route }: { route: ObjectRoute }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.16 }}
      className="h-full overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-slate-950/5 transition hover:border-accent-border hover:shadow-md hover:shadow-slate-950/10"
    >
      <Link
        href={`/objects/${route.id}`}
        className="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ObjectVisual type={route.visualType} />
        <div className="flex flex-1 flex-col p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-strong">{objectCategoryLabels[route.category]}</p>
          <h2 className="mt-2 text-base font-bold text-foreground">{route.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{route.shortDescription}</p>
          <p className="mt-4 text-sm font-semibold text-accent-strong">Open guide</p>
        </div>
      </Link>
    </motion.article>
  );
}
