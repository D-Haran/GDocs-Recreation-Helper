import type { Rule } from "@/data/rules";

export function searchRules(rules: Rule[], query: string) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return rules.filter((rule) => {
    const text = [rule.title, rule.do, rule.dont, rule.example ?? ""].join(" ").toLowerCase();
    return terms.length === 0 || terms.every((term) => text.includes(term));
  });
}
