"use client";

import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { rules } from "@/data/rules";
import type { ObjectCategory } from "@/data/routes";
import { objectCategoryLabels, objectCategoryOptions, objectRoutes } from "@/data/routes";
import { AnimatedPage } from "@/components/AnimatedPage";
import { CategoryFilter } from "@/components/CategoryFilter";
import { EmptyState } from "@/components/EmptyState";
import { GraderPanel } from "@/components/GraderPanel";
import { ObjectCard } from "@/components/ObjectCard";
import { RuleCard } from "@/components/RuleCard";
import { SearchBar } from "@/components/SearchBar";
import { cn } from "@/lib/cn";
import { searchObjectRoutes } from "@/lib/searchObjectRoutes";
import { searchRules } from "@/lib/searchRules";

type HomeTab = "rules" | "helper";

const tabs: Array<{ id: HomeTab; label: string; icon: typeof BookOpen }> = [
  { id: "rules", label: "Rules", icon: BookOpen },
  { id: "helper", label: "Recreation Helper", icon: Search },
];

export default function ObjectRouterPage() {
  const [activeTab, setActiveTab] = useState<HomeTab>("rules");
  const [rulesQuery, setRulesQuery] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ObjectCategory | "all">("all");

  const filteredRules = useMemo(() => searchRules(rules, rulesQuery), [rulesQuery]);
  const routes = useMemo(() => searchObjectRoutes(objectRoutes, query, category), [category, query]);
  const filterOptions = objectCategoryOptions.map((value) => ({ value, label: objectCategoryLabels[value] }));

  return (
    <AnimatedPage className="space-y-6">
      <GraderPanel compact />

      <section className="rounded-3xl border border-line bg-surface p-3 shadow-sm shadow-slate-950/5 sm:p-4">
        <div
          className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-muted p-1"
          role="tablist"
          aria-label="Home tools"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected
                    ? "bg-surface text-accent-strong shadow-sm ring-1 ring-line"
                    : "text-muted-strong hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {activeTab === "rules" ? (
            <div id="rules-panel" role="tabpanel" aria-labelledby="rules-tab" className="space-y-5">
              <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <h2 className="text-3xl font-black tracking-tight text-foreground">Rules</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Quick reminders for common recreation decisions.</p>
                <div className="mt-5">
                  <SearchBar
                    value={rulesQuery}
                    onChange={setRulesQuery}
                    label="Search rules"
                    placeholder="Search: screenshots, tables, headings, page breaks, links..."
                  />
                </div>
              </div>

              {filteredRules.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredRules.map((rule) => (
                    <RuleCard key={rule.id} rule={rule} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No rule matches" body="Try another search term." />
              )}
            </div>
          ) : (
            <div id="helper-panel" role="tabpanel" aria-labelledby="helper-tab" className="space-y-5">
              <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="mt-1 text-3xl font-black tracking-tight text-foreground">Recreation Helper</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                      Search what you see in the source file, then open the native Google Docs recreation guide.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    label="Search object routes"
                    placeholder="Search: table, chart, heading, footnote, columns, page number..."
                  />
                  <CategoryFilter options={filterOptions} active={category} onChange={setCategory} ariaLabel="Object categories" />
                </div>
              </div>

              {routes.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {routes.map((route) => (
                      <ObjectCard key={route.id} route={route} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <EmptyState title="No object matches" body="Try another object name, menu path, or visual cue." />
              )}
            </div>
          )}
        </div>
      </section>
    </AnimatedPage>
  );
}
