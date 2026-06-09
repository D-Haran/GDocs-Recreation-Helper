import type { Rule } from "@/data/rules";

export function RuleCard({ rule }: { rule: Rule }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-slate-950/5">
      <h2 className="text-lg font-bold text-foreground">{rule.title}</h2>
      <dl className="mt-4 space-y-3 text-sm leading-6">
        <div>
          <dt className="font-bold text-foreground">What to do</dt>
          <dd className="mt-1 text-muted">{rule.do}</dd>
        </div>
        <div>
          <dt className="font-bold text-foreground">What not to do</dt>
          <dd className="mt-1 text-muted">{rule.dont}</dd>
        </div>
        {rule.example ? (
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="font-bold text-foreground">Example</dt>
            <dd className="mt-1 text-muted">{rule.example}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
