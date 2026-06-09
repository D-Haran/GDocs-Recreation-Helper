import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { objectRoutes } from "@/data/routes";
import { guideCopy } from "@/data/guideCopy";
import { AnimatedPage } from "@/components/AnimatedPage";
import { ObjectVisual } from "@/components/ObjectVisual";

type ObjectGuidePageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return objectRoutes.map((route) => ({ slug: route.id }));
}

export function generateMetadata({ params }: ObjectGuidePageProps) {
  const route = objectRoutes.find((item) => item.id === params.slug);
  return {
    title: route ? `${route.title} | GDocs Recreation Helper` : "Object Guide",
  };
}

export default function ObjectGuidePage({ params }: ObjectGuidePageProps) {
  const route = objectRoutes.find((item) => item.id === params.slug);

  if (!route) {
    notFound();
  }

  const guide = guideCopy[route.id] ?? {
    steps: route.steps,
    doNot: route.neverUse,
  };

  return (
    <AnimatedPage className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to Object Router
        </Link>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-strong">Object guide</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{route.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{oneSentence(route.sourceLooksLike)}</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="space-y-4">
          <ObjectVisual type={route.visualType} large className="shadow-sm" />
          <QuickGuide route={route} />
        </aside>

        <main className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-slate-950/5 sm:p-6">
            <h2 className="text-base font-black text-foreground">Steps</h2>
            <ol className="mt-4 space-y-2.5">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-muted">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-black text-white shadow-sm shadow-purple-950/20 dark:text-slate-950">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {guide.doNot.length ? (
            <section className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
              <h2 className="text-sm font-black">Do not</h2>
              <ul className="mt-3 space-y-2">
                {guide.doNot.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6">
                    <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>
      </div>
    </AnimatedPage>
  );
}

function QuickGuide({ route }: { route: (typeof objectRoutes)[number] }) {
  const items = [
    ["Source looks like", route.sourceLooksLike],
    ["Build it as", route.buildAs],
    ["Menu path", route.menuPath],
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm shadow-slate-950/5">
      <h2 className="text-sm font-black text-foreground">Quick guide</h2>
      <dl className="mt-3 divide-y divide-line">
        {items.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[8.5rem_1fr]">
            <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
            <dd className="text-sm leading-6 text-muted-strong">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function oneSentence(value: string) {
  const match = value.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : value;
}
