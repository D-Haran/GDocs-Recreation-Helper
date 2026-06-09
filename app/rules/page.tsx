"use client";

import { useMemo, useState } from "react";
import { rules } from "@/data/rules";
import { AnimatedPage } from "@/components/AnimatedPage";
import { EmptyState } from "@/components/EmptyState";
import { RuleCard } from "@/components/RuleCard";
import { SearchBar } from "@/components/SearchBar";
import { searchRules } from "@/lib/searchRules";

export default function RulesPage() {
  const [query, setQuery] = useState("");
  const filteredRules = useMemo(() => searchRules(rules, query), [query]);

  return (
    <AnimatedPage className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm shadow-slate-950/5 sm:p-6">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Rules</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Quick reminders for common recreation decisions.</p>
        <div className="mt-5">
          <SearchBar value={query} onChange={setQuery} label="Search rules" placeholder="Search: screenshots, tables, headings, page breaks, links..." />
        </div>
      </section>

      {filteredRules.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      ) : (
        <EmptyState title="No rule matches" body="Try another search term." />
      )}
    </AnimatedPage>
  );
}
