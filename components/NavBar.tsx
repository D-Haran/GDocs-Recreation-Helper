"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Route, Sun, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Home" },
];

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLink = (href: string, label: string) => {
    const active = href === "/" ? pathname === "/" || pathname.startsWith("/objects/") : pathname === href;
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={cn(
          "rounded-full px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          active ? "bg-accent text-white shadow-sm dark:text-slate-950" : "text-muted-strong hover:bg-accent-soft hover:text-accent-strong",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 shadow-sm shadow-slate-950/5 backdrop-blur-xl transition-colors">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full pr-3 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm shadow-purple-950/20 dark:text-slate-950">
            <Route aria-hidden="true" size={16} />
          </span>
          <span>GDocs Recreation Helper</span>
        </Link>

        {/* <div className="hidden items-center gap-1 md:flex">{links.map((link) => navLink(link.href, link.label))}</div> */}

        <button
          type="button"
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-muted text-muted-strong transition hover:border-accent-border hover:bg-accent-soft hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {mounted && resolvedTheme === "dark" ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
        </button>

        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-muted text-muted-strong transition hover:border-accent-border hover:bg-accent-soft hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
        >
          {open ? <X aria-hidden="true" size={17} /> : <Menu aria-hidden="true" size={17} />}
        </button>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            className="border-t border-line bg-surface px-4 py-3 md:hidden"
          >
            <div className="flex flex-wrap gap-2">{links.map((link) => navLink(link.href, link.label))}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
