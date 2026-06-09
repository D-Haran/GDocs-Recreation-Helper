import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ObjectVisualProps = {
  type: string;
  large?: boolean;
  className?: string;
};

const sample = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
const short = "Lorem ipsum dolor sit amet";

function Frame({ children, className, large }: { children: ReactNode; className?: string; large?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-500 shadow-inner",
        large ? "h-72" : "h-44",
        className,
      )}
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {children}
    </div>
  );
}

function Para({ lines = 4, small = false }: { lines?: number; small?: boolean }) {
  return (
    <div className={cn("space-y-1.5", small ? "text-[10px] leading-4" : "text-xs leading-5")}>
      {Array.from({ length: lines }).map((_, index) => (
        <p key={index} className={cn("truncate text-slate-500/85", index % 3 === 1 && "pr-8", index % 3 === 2 && "pr-14")}>
          {index % 2 === 0 ? sample : "Sed do eiusmod tempor incididunt ut labore."}
        </p>
      ))}
    </div>
  );
}

function HighlightedTextPreview() {
  return (
    <div className="mx-auto h-full max-w-md rounded-xl border border-slate-200 bg-[#fffdf8] px-7 py-6 shadow-sm">
      <div className="space-y-3 text-[13px] leading-7 text-slate-600">
        <p>
          The project notes should remain editable in the final document. Use native formatting for any{" "}
          <mark className="rounded-[2px] bg-amber-200 px-0.5 text-slate-800">highlighted phrase</mark> that appears in the
          source.
        </p>
        <p className="text-slate-500">
          Keep surrounding body copy as normal text, then apply the closest highlight color only to the selected words.
        </p>
        <p className="text-slate-500">
          This preserves line wrapping, search, and future edits without flattening the page into an image.
        </p>
      </div>
    </div>
  );
}

function PreviewTable({ header, merged, borderless, shaded, long }: { header?: boolean; merged?: boolean; borderless?: boolean; shaded?: boolean; long?: boolean }) {
  const rows = long ? 7 : 4;
  return (
    <table className={cn("w-full table-fixed text-[10px] leading-4 text-slate-500/85", borderless ? "border-separate border-spacing-2" : "border-collapse")}>
      <tbody>
        {Array.from({ length: rows }).map((_, row) => (
          <tr key={row}>
            {Array.from({ length: 4 }).map((_, col) => {
              if (merged && row === 0 && col > 0 && col < 3) return null;
              return (
                <td
                  key={col}
                  colSpan={merged && row === 0 && col === 0 ? 3 : 1}
                  className={cn(
                    "truncate p-1.5",
                    borderless ? "rounded bg-slate-50" : "border border-slate-300",
                    header && row === 0 && "bg-slate-200 font-bold text-slate-500",
                    shaded && row === 2 && col > 0 && "bg-purple-50 text-purple-700/70",
                  )}
                >
                  {row === 0 ? ["Name", "Value", "Date", "Notes"][col] : short}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HeaderFooter({ footer }: { footer?: boolean }) {
  return (
    <div className="flex h-full flex-col justify-between text-xs text-slate-500/85">
      {!footer ? <div className="border-b border-slate-300 pb-2">Document header · Lorem ipsum</div> : <span />}
      <Para lines={5} />
      {footer ? <div className="border-t border-slate-300 pt-2 text-right">Footer · Page 3</div> : <span />}
    </div>
  );
}

function Chart({ kind }: { kind: "bar" | "line" | "pie" | "combo" }) {
  if (kind === "pie") {
    return (
      <div className="flex h-full items-center justify-center gap-5">
        <div className="h-24 w-24 rounded-full opacity-70" style={{ background: "conic-gradient(#94a3b8 0 42%, #c4b5fd 42% 70%, #e2e8f0 70% 100%)" }} />
        <div className="space-y-1 text-[10px] text-slate-400/80">
          <p>North 42%</p>
          <p>South 28%</p>
          <p>Other 30%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full rounded border border-slate-200 p-3 text-[10px] text-slate-400/80">
      <p className="mb-2 text-center text-slate-500/80">Quarterly results</p>
      <div className="absolute bottom-8 left-8 top-10 w-px bg-slate-300" />
      <div className="absolute bottom-8 left-8 right-4 h-px bg-slate-300" />
      {kind !== "line" ? (
        <div className="absolute bottom-8 left-12 right-8 grid h-24 grid-cols-4 items-end justify-items-center gap-3">
          {[42, 68, 52, 86].map((height, index) => (
            <div key={height} className={cn("w-5 rounded-t bg-slate-300", kind === "combo" && index === 3 && "bg-purple-300")} style={{ height }} />
          ))}
        </div>
      ) : null}
      {kind !== "bar" ? (
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 220 130">
          <polyline points="46,88 86,61 126,76 166,42" fill="none" stroke="#7c3aed" strokeWidth="3" />
        </svg>
      ) : null}
      <div className="absolute bottom-2 left-9 right-4 flex justify-between">
        <span>Q1</span>
        <span>Q2</span>
        <span>Q3</span>
        <span>Q4</span>
      </div>
    </div>
  );
}

function Diagram({ type }: { type: "flow" | "shape" | "timeline" | "process" }) {
  if (type === "timeline") {
    return (
      <div className="relative mt-12 h-24 text-[10px] text-slate-400/80">
        <div className="absolute left-4 right-4 top-8 h-px bg-slate-300" />
        {["Jan", "Mar", "Jun", "Sep"].map((label, index) => (
          <div key={label} className="absolute top-4 text-center" style={{ left: `${12 + index * 25}%` }}>
            <div className="mx-auto h-4 w-4 rounded-full border border-purple-400 bg-white" />
            <p className="mt-2">{label}</p>
            <p>{short}</p>
          </div>
        ))}
      </div>
    );
  }

  const labels = type === "process" ? ["1. Draft", "2. Review", "3. Final"] : ["Start", "Review", "Finish"];
  return (
    <div className="flex h-full items-center justify-center gap-3 text-center text-[10px] text-slate-500/80">
      {labels.map((label, index) => (
        <div key={label} className="flex items-center gap-3">
          <div className={cn("rounded border border-slate-300 bg-slate-50 px-3 py-4", type === "shape" && index === 1 && "rounded-full")}>
            <p className="font-semibold">{label}</p>
            <p className="mt-1 text-slate-400">Lorem ipsum</p>
          </div>
          {index < labels.length - 1 ? <span className="text-slate-300">→</span> : null}
        </div>
      ))}
    </div>
  );
}

export function ObjectVisual({ type, large = false, className }: ObjectVisualProps) {
  switch (type) {
    case "document-title":
      return (
        <Frame large={large} className={className}>
          <p className="mt-4 text-center text-2xl font-bold text-slate-500/80">Lorem Ipsum Report</p>
          <p className="mt-2 text-center text-sm text-slate-400/80">Prepared for document recreation</p>
          <div className="mt-8">
            <Para lines={3} />
          </div>
        </Frame>
      );
    case "section-heading":
      return (
        <Frame large={large} className={className}>
          <h3 className="text-xl font-bold text-slate-500/85">Section Heading</h3>
          <Para lines={5} />
        </Frame>
      );
    case "highlighted-text":
      return (
        <Frame large={large} className={cn("bg-slate-100/70 p-5 shadow-none", className)}>
          <HighlightedTextPreview />
        </Frame>
      );
    case "underlined-strikethrough":
      return (
        <Frame large={large} className={className}>
          <p className="text-xs leading-6 text-slate-400/80">
            Lorem ipsum <span className="underline">underlined text</span> and <span className="line-through">removed text</span>.
          </p>
          <Para lines={4} />
        </Frame>
      );
    case "small-note":
      return (
        <Frame large={large} className={className}>
          <Para lines={4} />
          <div className="mt-4 rounded bg-slate-50 p-3 text-[10px] leading-4 text-slate-400/80">
            Note: Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          </div>
        </Frame>
      );
    case "plain-table":
      return <Frame large={large} className={className}><PreviewTable /></Frame>;
    case "styled-header-table":
      return <Frame large={large} className={className}><PreviewTable header /></Frame>;
    case "merged-cell-table":
      return <Frame large={large} className={className}><PreviewTable header merged /></Frame>;
    case "borderless-layout-table":
      return <Frame large={large} className={className}><PreviewTable borderless /></Frame>;
    case "shaded-cell-table":
      return <Frame large={large} className={className}><PreviewTable shaded /></Frame>;
    case "long-table":
      return <Frame large={large} className={className}><PreviewTable header long /></Frame>;
    case "bar-chart":
      return <Frame large={large} className={className}><Chart kind="bar" /></Frame>;
    case "pie-chart":
      return <Frame large={large} className={className}><Chart kind="pie" /></Frame>;
    case "line-chart":
      return <Frame large={large} className={className}><Chart kind="line" /></Frame>;
    case "combo-chart":
      return <Frame large={large} className={className}><Chart kind="combo" /></Frame>;
    case "flowchart":
      return <Frame large={large} className={className}><Diagram type="flow" /></Frame>;
    case "shape-diagram":
      return <Frame large={large} className={className}><Diagram type="shape" /></Frame>;
    case "timeline-diagram":
      return <Frame large={large} className={className}><Diagram type="timeline" /></Frame>;
    case "process-diagram":
      return <Frame large={large} className={className}><Diagram type="process" /></Frame>;
    case "photo-scan":
      return (
        <Frame large={large} className={className}>
          <div className="h-full rounded bg-slate-100 p-4 text-xs text-slate-400/80">
            <p className="mb-4">Scanned image area</p>
            <Para lines={5} />
          </div>
        </Frame>
      );
    case "logo":
      return (
        <Frame large={large} className={className}>
          <div className="flex h-full items-center justify-center gap-3 text-slate-500/80">
            <div className="h-12 w-12 rounded border border-slate-300 bg-slate-100" />
            <div>
              <p className="text-lg font-bold">Lorem Co.</p>
              <p className="text-xs text-slate-400/80">Sample logo</p>
            </div>
          </div>
        </Frame>
      );
    case "image-caption":
      return (
        <Frame large={large} className={className}>
          <div className="mx-auto h-24 w-36 rounded bg-slate-100" />
          <p className="mt-3 text-center text-[10px] italic text-slate-400/80">Figure 1. Lorem ipsum dolor sit amet.</p>
        </Frame>
      );
    case "inline-icon":
      return (
        <Frame large={large} className={className}>
          <ul className="space-y-3 text-xs text-slate-400/80">
            <li>● Lorem ipsum dolor sit amet</li>
            <li>◆ Sed do eiusmod tempor</li>
            <li>■ Consectetur adipiscing elit</li>
          </ul>
        </Frame>
      );
    case "header":
      return <Frame large={large} className={className}><HeaderFooter /></Frame>;
    case "footer":
      return <Frame large={large} className={className}><HeaderFooter footer /></Frame>;
    case "page-number":
      return (
        <Frame large={large} className={className}>
          <Para lines={6} />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-500/80">3</p>
        </Frame>
      );
    case "footnote":
      return (
        <Frame large={large} className={className}>
          <p className="text-xs text-slate-400/80">Lorem ipsum dolor sit amet.<sup>1</sup></p>
          <Para lines={3} />
          <p className="absolute bottom-4 left-4 right-4 border-t border-slate-300 pt-2 text-[10px] text-slate-400/80">1. Lorem ipsum footnote text.</p>
        </Frame>
      );
    case "table-of-contents":
      return (
        <Frame large={large} className={className}>
          <p className="mb-3 text-lg font-bold text-slate-500/80">Contents</p>
          {["Introduction", "Method", "Findings", "Appendix"].map((item, index) => (
            <p key={item} className="flex gap-2 text-xs text-slate-400/80">
              <span>{item}</span><span className="flex-1 border-b border-dotted border-slate-300" /><span>{index + 1}</span>
            </p>
          ))}
        </Frame>
      );
    case "watermark":
      return (
        <Frame large={large} className={className}>
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 text-3xl font-bold uppercase text-slate-300/70">Draft</p>
          <Para lines={7} />
        </Frame>
      );
    case "page-break":
      return (
        <Frame large={large} className={className}>
          <Para lines={3} />
          <p className="my-5 border-y border-dashed border-slate-300 py-2 text-center text-[10px] uppercase text-slate-400">Page break</p>
          <Para lines={3} />
        </Frame>
      );
    case "section-break":
      return (
        <Frame large={large} className={className}>
          <div className="grid grid-cols-2 gap-5">
            <Para lines={6} small />
            <div className="rounded bg-slate-50 p-2"><Para lines={6} small /></div>
          </div>
        </Frame>
      );
    case "two-column-layout":
      return (
        <Frame large={large} className={className}>
          <div className="grid grid-cols-2 gap-5">
            <Para lines={7} small />
            <Para lines={7} small />
          </div>
        </Frame>
      );
    case "horizontal-divider":
      return (
        <Frame large={large} className={className}>
          <Para lines={3} />
          <hr className="my-5 border-slate-300" />
          <Para lines={3} />
        </Frame>
      );
    case "large-spacing":
      return (
        <Frame large={large} className={className}>
          <Para lines={3} />
          <div className="h-14" />
          <Para lines={3} />
        </Frame>
      );
    case "hyperlink":
      return (
        <Frame large={large} className={className}>
          <p className="text-xs leading-6 text-slate-400/80">
            Lorem ipsum <span className="text-blue-500 underline">example.com/reference</span> dolor sit amet.
          </p>
          <Para lines={4} />
        </Frame>
      );
    case "bookmark":
      return (
        <Frame large={large} className={className}>
          <p className="text-xs text-purple-500/80">Jump to Method section</p>
          <h3 className="mt-5 text-base font-bold text-slate-500/80">Method</h3>
          <Para lines={4} />
        </Frame>
      );
    case "citation":
      return (
        <Frame large={large} className={className}>
          <p className="text-xs text-slate-400/80">Lorem ipsum dolor sit amet (Author, 2024).</p>
          <div className="mt-5 border-l-2 border-slate-300 pl-3 text-[10px] leading-4 text-slate-400/80">
            Author. Title. Publisher, 2024.
          </div>
        </Frame>
      );
    case "special-character":
      return (
        <Frame large={large} className={className}>
          <p className="grid h-full place-items-center text-4xl text-slate-500/80">Ω → ° ©</p>
        </Frame>
      );
    case "equation":
      return (
        <Frame large={large} className={className}>
          <p className="grid h-full place-items-center text-3xl italic text-slate-500/80">x² + y² = z²</p>
        </Frame>
      );
    default:
      return <Frame large={large} className={className}><Para lines={6} /></Frame>;
  }
}
