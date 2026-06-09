"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ListFilter, Minus, Plus, UploadCloud } from "lucide-react";
import type { AnnotationRegion, ConcreteIssue, DocumentPreview, GradeResult, IssueAnnotation } from "@/lib/graderTypes";
import { cn } from "@/lib/cn";

type FileSlot = "original" | "recreated";
type IssueFilter = "all" | "text" | "structure" | "layout" | "high";
type AnnotationMode = "clean" | "pins" | "focus" | "structure";
type PaneSide = "original" | "recreated";
type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
};
type PdfDocument = { numPages: number; getPage: (pageNumber: number) => Promise<PdfPage> };
type PdfLoadingTask = { promise: Promise<PdfDocument>; destroy: () => Promise<void> };
type PdfRenderTask = { promise: Promise<void>; cancel?: () => void };

const acceptedTypes = [".pdf", ".docx"];
const maxSize = 15 * 1024 * 1024;
const pageWidth = 612;
const pageHeight = 792;

export function GraderPanel({ compact = false }: { compact?: boolean }) {
  const [original, setOriginal] = useState<File | null>(null);
  const [recreated, setRecreated] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const originalUrl = useObjectUrl(original);
  const recreatedUrl = useObjectUrl(recreated);

  const canSubmit = useMemo(() => original && recreated && !loading, [loading, original, recreated]);

  const setFile = (slot: FileSlot, file: File | null) => {
    setError("");
    setResult(null);

    if (file) {
      const validation = validateUpload(file);
      if (validation) {
        setError(validation);
        file = null;
      }
    }

    if (slot === "original") {
      setOriginal(file);
    } else {
      setRecreated(file);
    }
  };

  const submit = async () => {
    if (!original || !recreated) {
      setError("Upload both files before grading.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("original", original);
    formData.append("recreated", recreated);

    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? payload.error ?? "Unable to grade these files.");
      }

      setResult(payload as GradeResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to grade these files.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-sm shadow-slate-950/5 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">Grader</p>
          <h1 className={compact ? "mt-1 text-2xl font-black tracking-tight text-foreground" : "mt-1 text-3xl font-black tracking-tight text-foreground"}>
            Native Google Docs recreation grader
          </h1>
        </div>
        {/* <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">PDF or DOCX. DOCX previews convert to PDF transiently.</p> */}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UploadBox
          title="Original"
          description="Source PDF or DOCX"
          file={original}
          inputId="original-file"
          onChange={(file) => setFile("original", file)}
        />
        <UploadBox
          title="Recreated"
          description="Exported PDF or DOCX"
          file={recreated}
          inputId="recreated-file"
          onChange={(file) => setFile("recreated", file)}
        />
      </div>

      <p className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-muted">
        Files are used only to run this grading request. Uploads are processed transiently and are not stored after grading.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="inline-flex w-fit items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-bold text-white shadow-sm shadow-purple-950/20 transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-slate-950 dark:disabled:text-muted"
        >
          {loading ? "Grading..." : "Grade recreation"}
        </button>
        {error ? <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p> : null}
      </div>

      {result ? (
        <Results
          result={result}
          originalPdfUrl={result.previews.original.pdfDataUrl || (isPdf(original) ? originalUrl : "")}
          recreatedPdfUrl={result.previews.recreated.pdfDataUrl || (isPdf(recreated) ? recreatedUrl : "")}
        />
      ) : null}
    </section>
  );
}

function UploadBox({
  title,
  description,
  file,
  inputId,
  onChange,
}: {
  title: string;
  description: string;
  file: File | null;
  inputId: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label
      htmlFor={inputId}
      className="group block min-h-56 cursor-pointer rounded-2xl border border-dashed border-line-strong bg-surface-muted p-5 transition hover:border-accent-border hover:bg-accent-soft/60 sm:p-6"
    >
      <input
        id={inputId}
        type="file"
        accept={acceptedTypes.join(",")}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <span className="text-sm font-black text-foreground">{title}</span>
      <span className="ml-2 text-xs font-semibold text-muted">{description}</span>
      <span className="mt-4 flex min-h-36 items-center gap-4 rounded-xl bg-surface p-5 text-sm text-muted-strong shadow-sm shadow-slate-950/5 ring-1 ring-line transition group-hover:ring-accent-border sm:min-h-40 sm:p-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong ring-1 ring-accent-border">
          <FileText aria-hidden="true" className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
        {file ? (
          <>
            <span className="block truncate font-bold text-foreground">{file.name}</span>
            <span className="mt-1 block font-semibold text-muted">{formatSize(file.size)}</span>
          </>
        ) : (
          <>
            <span className="block text-lg font-black text-foreground">Choose a file</span>
            <span className="mt-1 flex items-center gap-2 font-semibold text-muted">
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              PDF or DOCX
            </span>
          </>
        )}
        </span>
      </span>
    </label>
  );
}

function Results({ result, originalPdfUrl, recreatedPdfUrl }: { result: GradeResult; originalPdfUrl: string; recreatedPdfUrl: string }) {
  return (
    <section className="rounded-2xl border border-line bg-surface-muted/80 p-3">
      <VisualComparison result={result} originalPdfUrl={originalPdfUrl} recreatedPdfUrl={recreatedPdfUrl} />
    </section>
  );
}

function VisualComparison({ result, originalPdfUrl, recreatedPdfUrl }: { result: GradeResult; originalPdfUrl: string; recreatedPdfUrl: string }) {
  const pagesWithIssues = useMemo(() => {
    const values = new Set(result.issues.flatMap((issue) => issue.pageNumber));
    return values.size ? values : new Set([1]);
  }, [result.issues]);
  const [pageNumber, setPageNumber] = useState(result.previews.original.pages[0]?.pageNumber ?? 1);
  const [zoom, setZoom] = useState(1);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>("focus");
  const [issuePagesOnly, setIssuePagesOnly] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [activeIssueId, setActiveIssueId] = useState(result.issues[0]?.id ?? "");
  const [hoveredIssueId, setHoveredIssueId] = useState("");
  const originalRef = useRef<HTMLDivElement>(null);
  const recreatedRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const availablePages = useMemo(() => {
    const allPages = result.previews.original.pages.map((page) => page.pageNumber);
    return issuePagesOnly ? allPages.filter((page) => pagesWithIssues.has(page)) : allPages;
  }, [issuePagesOnly, pagesWithIssues, result.previews.original.pages]);

  const selectedPage = availablePages.includes(pageNumber) ? pageNumber : availablePages[0] ?? 1;
  const activeIssue = result.issues.find((issue) => issue.id === activeIssueId) ?? result.issues[0];
  const visibleOverlayIssues = useMemo(
    () => result.issues.filter((issue) => issue.impact !== "low" && issue.confidence !== "low"),
    [result.issues],
  );

  useEffect(() => {
    if (selectedPage !== pageNumber) setPageNumber(selectedPage);
  }, [pageNumber, selectedPage]);

  useEffect(() => {
    const issue = result.issues.find((item) => item.id === activeIssueId);
    if (!issue) return;
    setPageNumber(issue.pageNumber);
    if (annotationMode === "focus") {
      scrollPaneToIssue(originalRef.current, issue.annotation.original, zoom);
      scrollPaneToIssue(recreatedRef.current, issue.annotation.recreated, zoom);
    }
  }, [activeIssueId, annotationMode, result.issues, zoom]);

  const syncPaneScroll = (from: PaneSide) => {
    if (!syncScroll || syncing.current) return;
    const source = from === "original" ? originalRef.current : recreatedRef.current;
    const target = from === "original" ? recreatedRef.current : originalRef.current;
    if (!source || !target) return;
    syncing.current = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  const focusIssue = (issue: ConcreteIssue) => {
    setActiveIssueId(issue.id);
    setPageNumber(issue.pageNumber);
  };

  const goToPage = (direction: -1 | 1) => {
    const currentIndex = availablePages.indexOf(selectedPage);
    if (currentIndex < 0) return;
    const nextPage = availablePages[Math.max(0, Math.min(availablePages.length - 1, currentIndex + direction))];
    if (nextPage) setPageNumber(nextPage);
  };

  return (
    <div className="space-y-4">
      <ScoreSummary result={result} />
      <ControlBar
        pageNumber={selectedPage}
        availablePages={availablePages}
        annotationMode={annotationMode}
        issuePagesOnly={issuePagesOnly}
        syncScroll={syncScroll}
        onPageChange={setPageNumber}
        onPreviousPage={() => goToPage(-1)}
        onNextPage={() => goToPage(1)}
        onZoomOut={() => setZoom((value) => Math.max(0.75, Number((value - 0.1).toFixed(1))))}
        onZoomIn={() => setZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(1))))}
        onAnnotationModeChange={setAnnotationMode}
        onToggleIssuePages={() => setIssuePagesOnly((value) => !value)}
        onToggleSync={() => setSyncScroll((value) => !value)}
      />
      {result.identityCheck && !result.identityCheck.isLikelySameDocument ? <IdentityMismatchBanner result={result} /> : null}
      {result.previews.recreated.fileType === "pdf" ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          Native editability cannot be fully verified from PDF exports. Table/list/heading feedback is based on visual structure.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <PdfPane
            title="Original"
            side="original"
            preview={result.previews.original}
            pdfUrl={originalPdfUrl}
            issues={visibleOverlayIssues}
            pageNumber={selectedPage}
            zoom={zoom}
            annotationMode={annotationMode}
            activeIssueId={activeIssueId}
            hoveredIssueId={hoveredIssueId}
            scrollRef={originalRef}
            onScroll={() => syncPaneScroll("original")}
            onIssueSelect={focusIssue}
            onIssueHover={setHoveredIssueId}
          />
          <PdfPane
            title="Recreated"
            side="recreated"
            preview={result.previews.recreated}
            pdfUrl={recreatedPdfUrl}
            issues={visibleOverlayIssues}
            pageNumber={selectedPage}
            zoom={zoom}
            annotationMode={annotationMode}
            activeIssueId={activeIssueId}
            hoveredIssueId={hoveredIssueId}
            scrollRef={recreatedRef}
            onScroll={() => syncPaneScroll("recreated")}
            onIssueSelect={focusIssue}
            onIssueHover={setHoveredIssueId}
          />
        </div>
        <IssueRail
          issues={result.issues}
          activeIssueId={activeIssueId}
          activeIssue={activeIssue}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={focusIssue}
        />
      </div>

      <details className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
        <summary className="cursor-pointer text-sm font-black text-foreground">Details</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="font-bold text-foreground">Verdict</p>
            <p className="mt-1">{result.verdict}</p>
          </div>
          <div>
            <p className="font-bold text-foreground">Category scores</p>
            <p className="mt-1">
              {result.categoryScores.map((category) => `${category.name}: ${category.points}/${category.maxPoints}`).join(" | ")}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

function ScoreSummary({ result }: { result: GradeResult }) {
  const tone = scoreTone(result.overallScore);
  const label = result.status === "Wrong file / unrelated document" ? "Wrong file / unrelated document" : scoreLabel(result.overallScore);

  return (
    <section className={cn("rounded-2xl border px-4 py-5 text-center shadow-sm", tone.card)}>
      <div className="mx-auto flex w-fit items-baseline justify-center gap-1">
        <span className={cn("text-6xl font-black leading-none tracking-normal sm:text-7xl", tone.text)}>{result.overallScore}</span>
        <span className="text-xl font-black text-muted">/100</span>
      </div>
      <p className={cn("mt-2 text-base font-black", tone.text)}>{label}</p>
      <p className="mt-1 text-xs font-semibold text-muted">{result.verdict}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <MetricPill label={`${actionableIssueCount(result.issues)} issues`} />
        <MetricPill label={`Visual match ${result.metrics.visualMatch}%`} />
        <MetricPill label={`Content ${result.metrics.contentCoverage}%`} />
      </div>
    </section>
  );
}

function MetricPill({ label }: { label: string }) {
  return <span className="rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-bold text-muted-strong shadow-sm shadow-slate-950/5">{label}</span>;
}

function ControlBar({
  pageNumber,
  availablePages,
  annotationMode,
  issuePagesOnly,
  syncScroll,
  onPageChange,
  onPreviousPage,
  onNextPage,
  onZoomOut,
  onZoomIn,
  onAnnotationModeChange,
  onToggleIssuePages,
  onToggleSync,
}: {
  pageNumber: number;
  availablePages: number[];
  annotationMode: AnnotationMode;
  issuePagesOnly: boolean;
  syncScroll: boolean;
  onPageChange: (page: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onAnnotationModeChange: (mode: AnnotationMode) => void;
  onToggleIssuePages: () => void;
  onToggleSync: () => void;
}) {
  const modes: Array<{ value: AnnotationMode; label: string }> = [
    { value: "clean", label: "Clean" },
    { value: "pins", label: "Pins" },
    { value: "focus", label: "Focus" },
    { value: "structure", label: "Structure" },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface/90 p-2">
      <div className="flex min-w-max items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <IconButton label="Previous page" onClick={onPreviousPage}>
            <ChevronLeft size={17} />
          </IconButton>
          <IconButton label="Next page" onClick={onNextPage}>
            <ChevronRight size={17} />
          </IconButton>
          <label className="ml-1 flex items-center gap-2 rounded-lg bg-surface-muted px-2.5 py-2 text-xs font-bold text-muted-strong">
            Page
            <select
              value={pageNumber}
              onChange={(event) => onPageChange(Number(event.target.value))}
              className="bg-transparent text-sm font-black text-foreground focus:outline-none"
            >
              {availablePages.map((page) => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex rounded-lg bg-surface-muted p-1">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onAnnotationModeChange(mode.value)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-black transition",
                annotationMode === mode.value ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-muted-strong",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onToggleIssuePages} className={cn(controlButtonClass, issuePagesOnly && "bg-foreground text-background hover:bg-muted-strong")}>
            Issue pages
          </button>
          <IconButton label="Zoom out" onClick={onZoomOut}>
            <Minus size={17} />
          </IconButton>
          <IconButton label="Zoom in" onClick={onZoomIn}>
            <Plus size={17} />
          </IconButton>
          <button type="button" onClick={onToggleSync} className={cn(controlButtonClass, syncScroll && "bg-foreground text-background hover:bg-muted-strong")}>
            Sync scroll
          </button>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(iconButtonClass, active && "border-accent-border bg-accent-soft text-accent-strong")}
    >
      {children}
    </button>
  );
}

function IdentityMismatchBanner({ result }: { result: GradeResult }) {
  const identity = result.identityCheck;
  if (!identity) return null;

  return (
    <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">
      <p className="font-black">These appear to be different documents.</p>
      <div className="mt-2 grid gap-2 text-xs font-semibold text-red-900 dark:text-red-100 sm:grid-cols-2">
        <p>Source title/heading: {identity.originalTitle}</p>
        <p>Recreated title/heading: {identity.recreatedTitle}</p>
        <p>Content overlap: {identity.contentCoverage}%</p>
        <p>Heading overlap: {identity.headingOverlap}%</p>
        <p>Keyword overlap: {identity.keywordOverlap}%</p>
        <p>{identity.objectMismatch ? "Source objects do not match the recreated file." : "Object match was insufficient to pass identity preflight."}</p>
      </div>
    </section>
  );
}

function PdfPane({
  title,
  side,
  preview,
  pdfUrl,
  issues,
  pageNumber,
  zoom,
  annotationMode,
  activeIssueId,
  hoveredIssueId,
  scrollRef,
  onScroll,
  onIssueSelect,
  onIssueHover,
}: {
  title: string;
  side: PaneSide;
  preview: DocumentPreview;
  pdfUrl: string;
  issues: ConcreteIssue[];
  pageNumber: number;
  zoom: number;
  annotationMode: AnnotationMode;
  activeIssueId: string;
  hoveredIssueId: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onIssueSelect: (issue: ConcreteIssue) => void;
  onIssueHover: (issueId: string) => void;
}) {
  const page = preview.pages.find((item) => item.pageNumber === pageNumber) ?? preview.pages[0];

  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface-muted p-2">
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-foreground">{title}</h2>
          <p className="truncate text-xs font-semibold text-muted">{preview.fileName}</p>
          {preview.conversionNotice ? <p className="truncate text-[11px] font-semibold text-muted">{preview.conversionNotice}</p> : null}
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-black text-muted-strong">Page {pageNumber}</span>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="pdf-pane-scroll h-[40rem] rounded-lg border border-line bg-line-strong/35 p-4 dark:bg-slate-950/40">
        <PageSurface
          key={`${side}-${preview.fileName}-${pdfUrl}-${pageNumber}`}
          side={side}
          preview={preview}
          pdfUrl={pdfUrl}
          page={page}
          issues={issues}
          pageNumber={pageNumber}
          zoom={zoom}
          annotationMode={annotationMode}
          activeIssueId={activeIssueId}
          hoveredIssueId={hoveredIssueId}
          onIssueSelect={onIssueSelect}
          onIssueHover={onIssueHover}
        />
      </div>
    </section>
  );
}

function PageSurface({
  side,
  preview,
  pdfUrl,
  page,
  issues,
  pageNumber,
  zoom,
  annotationMode,
  activeIssueId,
  hoveredIssueId,
  onIssueSelect,
  onIssueHover,
}: {
  side: PaneSide;
  preview: DocumentPreview;
  pdfUrl: string;
  page: DocumentPreview["pages"][number] | undefined;
  issues: ConcreteIssue[];
  pageNumber: number;
  zoom: number;
  annotationMode: AnnotationMode;
  activeIssueId: string;
  hoveredIssueId: string;
  onIssueSelect: (issue: ConcreteIssue) => void;
  onIssueHover: (issueId: string) => void;
}) {
  const [renderSize, setRenderSize] = useState({ width: pageWidth * zoom, height: pageHeight * zoom });
  const [renderFailed, setRenderFailed] = useState(false);
  const [renderError, setRenderError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canRenderPdf = Boolean(pdfUrl && preview.renderingMode === "pdf");

  useEffect(() => {
    setRenderFailed(false);
    setRenderError("");
  }, [pdfUrl, pageNumber]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && (!canRenderPdf || renderFailed) && page?.blocks.length) {
      console.warn("Grader visual preview should use PDF canvas, not extracted blocks.");
    }
  }, [canRenderPdf, page?.blocks.length, renderFailed]);

  useEffect(() => {
    if (!canRenderPdf || renderFailed || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    let loadingTask: PdfLoadingTask | null = null;
    let renderTask: PdfRenderTask | null = null;

    import("pdfjs-dist")
      .then((pdfjsLib) => {
        if (cancelled) return null;
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        loadingTask = pdfjsLib.getDocument(pdfUrl) as unknown as PdfLoadingTask;
        return loadingTask.promise;
      })
      .then((pdf) => {
        if (!pdf || cancelled) return null;
        return pdf.getPage(Math.min(pageNumber, pdf.numPages));
      })
      .then((pdfPage) => {
        if (!pdfPage || cancelled) return null;
        const viewport = pdfPage.getViewport({ scale: zoom });
        const context = canvas.getContext("2d");
        if (!context) return null;
        context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        setRenderSize({ width: viewport.width, height: viewport.height });
        renderTask = pdfPage.render({ canvasContext: context, viewport });
        return renderTask.promise;
      })
      .catch(() => {
        if (!cancelled) {
          setRenderFailed(true);
          setRenderError("PDF canvas preview unavailable. Upload or export a valid PDF and try again.");
        }
      });

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      void loadingTask?.destroy();
    };
  }, [canRenderPdf, pageNumber, pdfUrl, renderFailed, zoom]);

  const shellSize = canRenderPdf && !renderFailed ? renderSize : { width: pageWidth * zoom, height: pageHeight * zoom };

  return (
    <div className="pdf-page-shell shadow-xl ring-1 ring-slate-300" style={{ width: shellSize.width, height: shellSize.height }}>
      {canRenderPdf && !renderFailed ? <canvas ref={canvasRef} className="pdf-canvas" /> : null}
      {!canRenderPdf || renderFailed ? (
        <div className="grid h-full place-items-center px-8 text-center text-sm font-semibold text-slate-600">
          {renderError || "PDF canvas preview unavailable. DOCX files must convert to PDF before visual preview."}
        </div>
      ) : null}
      <AnnotationOverlay
        side={side}
        issues={issues}
        pageNumber={pageNumber}
        size={shellSize}
        annotationMode={annotationMode}
        page={page}
        activeIssueId={activeIssueId}
        hoveredIssueId={hoveredIssueId}
        onIssueSelect={onIssueSelect}
        onIssueHover={onIssueHover}
      />
    </div>
  );
}

function AnnotationLayer({ children }: { children: React.ReactNode }) {
  return (
    <div className="annotation-layer" aria-hidden="true">
      {children}
    </div>
  );
}

function PinLayer({ children }: { children: React.ReactNode }) {
  return <div className="pin-layer">{children}</div>;
}

function AnnotationOverlay({
  side,
  issues,
  pageNumber,
  size,
  annotationMode,
  page,
  activeIssueId,
  hoveredIssueId,
  onIssueSelect,
  onIssueHover,
}: {
  side: PaneSide;
  issues: ConcreteIssue[];
  pageNumber: number;
  size: { width: number; height: number };
  annotationMode: AnnotationMode;
  page: DocumentPreview["pages"][number] | undefined;
  activeIssueId: string;
  hoveredIssueId: string;
  onIssueSelect: (issue: ConcreteIssue) => void;
  onIssueHover: (issueId: string) => void;
}) {
  if (annotationMode === "clean") return null;

  if (annotationMode === "structure") {
    return (
      <AnnotationLayer>
        {page?.blocks.map((block) => {
          if (block.kind === "paragraph" || block.kind === "image") return null;
          return (
            <div
              key={`${side}-structure-${block.id}`}
              className={cn("absolute rounded-sm border", structureClass(block.kind))}
              style={regionStyle(block.bounds, size)}
            />
          );
        })}
      </AnnotationLayer>
    );
  }

  return (
    <PinLayer>
      {issues.map((issue, index) => {
        const region = regionForSide(issue.annotation, side);
        if (!region || region.pageNumber !== pageNumber) return null;
        const active = issue.id === activeIssueId;
        const hovered = issue.id === hoveredIssueId;
        if (annotationMode === "focus" && !active) return null;
        const marker = index + 1;
        const pinStyle = pinRegionStyle(region, size);
        return (
          <button
            key={`${side}-${issue.id}`}
            type="button"
            aria-label={`Issue ${marker}: ${issue.title}`}
            onClick={() => onIssueSelect(issue)}
            onMouseEnter={() => onIssueHover(issue.id)}
            onMouseLeave={() => onIssueHover("")}
            className={cn(
              "pointer-events-auto absolute text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950",
              active || hovered ? "z-20" : "z-10",
              annotationMode === "focus" && "rounded-md",
            )}
            style={annotationMode === "focus" ? regionStyle(region, size) : pinStyle}
          >
            {annotationMode === "focus" ? (
              <span
                className={cn(
                  "absolute inset-0 rounded-md border-2 bg-white/5",
                  toneBoxClass(issue.annotation.tone),
                  "ring-4 ring-slate-950/10",
                )}
              />
            ) : null}
            <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-black text-white shadow", toneMarkerClass(issue.annotation.tone), active || hovered ? "ring-4 ring-white" : "")}>
              {marker}
            </span>
            {annotationMode === "focus" ? (
              <span className={cn("absolute left-7 top-0 max-w-[11rem] rounded px-2 py-1 text-[11px] font-black shadow-sm", toneLabelClass(issue.annotation.tone))}>
                {issue.annotation.fixLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </PinLayer>
  );
}

function IssueRail({
  issues,
  activeIssueId,
  activeIssue,
  filter,
  onFilterChange,
  onSelect,
}: {
  issues: ConcreteIssue[];
  activeIssueId: string;
  activeIssue: ConcreteIssue | undefined;
  filter: IssueFilter;
  onFilterChange: (filter: IssueFilter) => void;
  onSelect: (issue: ConcreteIssue) => void;
}) {
  const filteredIssues = issues.filter((issue) => issueMatchesFilter(issue, filter));
  const importantIssues = filteredIssues.filter((issue) => issue.impact !== "low" && issue.confidence !== "low").slice(0, 5);
  const minorIssues = filteredIssues.filter((issue) => !importantIssues.includes(issue));
  const filters: Array<{ value: IssueFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "text", label: "Text" },
    { value: "structure", label: "Structure" },
    { value: "layout", label: "Layout" },
    { value: "high", label: "High" },
  ];

  return (
    <aside className="rounded-xl border border-line bg-surface p-3 shadow-sm shadow-slate-950/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-foreground">Issues</h2>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-black text-muted-strong">{issues.length}</span>
        </div>
        <ListFilter size={15} className="text-muted" aria-hidden="true" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-black transition",
              filter === item.value ? "bg-foreground text-background" : "bg-surface-muted text-muted hover:bg-surface-raised hover:text-muted-strong",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-1">
        {importantIssues.map((issue) => {
          const index = issues.findIndex((item) => item.id === issue.id) + 1;
          return (
            <button
              key={issue.id}
              type="button"
              onClick={() => onSelect(issue)}
              className={cn(
                "w-full rounded-md border px-2.5 py-2 text-left transition hover:border-line-strong hover:bg-surface-muted",
                issue.id === activeIssueId ? "border-accent-border bg-accent-soft shadow-sm" : "border-transparent bg-surface",
              )}
            >
              <p className="truncate text-xs font-black leading-5 text-foreground">#{index} {issue.title}</p>
              <p className="truncate text-[11px] font-semibold text-muted">Page {issue.pageNumber} · {issue.annotation.fixLabel}</p>
            </button>
          );
        })}
      </div>
      {minorIssues.length ? (
        <details className="mt-3 rounded-lg bg-surface-muted">
          <summary className="cursor-pointer px-3 py-2 text-xs font-black text-muted">Minor issues ({minorIssues.length})</summary>
          <div className="space-y-1 border-t border-line p-2">
            {minorIssues.map((issue) => {
              const index = issues.findIndex((item) => item.id === issue.id) + 1;
              return (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onSelect(issue)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-2 text-left transition hover:bg-surface",
                    issue.id === activeIssueId ? "bg-accent-soft text-accent-strong" : "text-muted-strong",
                  )}
                >
                  <p className="truncate text-xs font-bold leading-5">#{index} {issue.title} · Page {issue.pageNumber}</p>
                </button>
              );
            })}
          </div>
        </details>
      ) : null}
      {activeIssue ? (
        <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
          <p className="text-sm font-black leading-5 text-foreground">{activeIssue.title}</p>
          <p className="mt-1 text-[11px] font-bold uppercase text-muted">
            Page {activeIssue.pageNumber} · {activeIssue.impact} impact · {activeIssue.confidence} confidence
          </p>
          <p className="mt-1 text-[11px] font-semibold text-muted">Evidence: {evidenceLabel(activeIssue.evidenceSource)}</p>
          <p className="mt-2 line-clamp-4 text-xs leading-5 text-muted-strong">
            <span className="font-black text-foreground">Problem:</span> {activeIssue.explanation}
          </p>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-strong">
            <span className="font-black text-foreground">Fix:</span> {activeIssue.fix}
          </p>
        </div>
      ) : null}
    </aside>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

function scrollPaneToIssue(container: HTMLDivElement | null, region: AnnotationRegion | undefined, zoom: number) {
  if (!container || !region) return;
  const y = Math.max(0, region.y * pageHeight * zoom - 90);
  container.scrollTo({ top: y, behavior: "smooth" });
}

function regionForSide(annotation: IssueAnnotation, side: PaneSide) {
  return side === "original" ? annotation.original : annotation.recreated;
}

function regionStyle(region: AnnotationRegion, size: { width: number; height: number }) {
  return {
    left: region.x * size.width,
    top: region.y * size.height,
    width: region.width * size.width,
    height: region.height * size.height,
  };
}

function pinRegionStyle(region: AnnotationRegion, size: { width: number; height: number }) {
  return {
    left: Math.max(4, region.x * size.width + 4),
    top: Math.max(4, region.y * size.height + 4),
    width: 24,
    height: 24,
  };
}

function structureClass(kind: DocumentPreview["pages"][number]["blocks"][number]["kind"]) {
  if (kind === "heading") return "border-blue-500 bg-blue-400/10";
  if (kind === "list") return "border-emerald-500 bg-emerald-400/10";
  if (kind === "table") return "border-purple-500 bg-purple-400/10";
  return "border-slate-400 bg-slate-300/10";
}

function issueMatchesFilter(issue: ConcreteIssue, filter: IssueFilter) {
  if (filter === "all") return true;
  if (filter === "high") return issue.severity === "high";
  return issue.annotation.tone === filter;
}

function actionableIssueCount(issues: ConcreteIssue[]) {
  return issues.filter((issue) => issue.scoreImpact.pointsLost > 0).length;
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent recreation";
  if (score >= 80) return "Good recreation";
  if (score >= 70) return "Borderline";
  if (score >= 60) return "Needs revision";
  return "Major revision needed";
}

function scoreTone(score: number) {
  if (score >= 90) {
    return {
      card: "border-emerald-200 bg-emerald-50/80 shadow-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:shadow-none",
      text: "text-emerald-700 dark:text-emerald-300",
    };
  }
  if (score >= 80) {
    return {
      card: "border-cyan-200 bg-cyan-50/80 shadow-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:shadow-none",
      text: "text-cyan-700 dark:text-cyan-300",
    };
  }
  if (score >= 70) {
    return {
      card: "border-amber-200 bg-amber-50/80 shadow-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:shadow-none",
      text: "text-amber-700 dark:text-amber-300",
    };
  }
  if (score >= 60) {
    return {
      card: "border-orange-200 bg-orange-50/80 shadow-orange-100 dark:border-orange-400/30 dark:bg-orange-400/10 dark:shadow-none",
      text: "text-orange-700 dark:text-orange-300",
    };
  }
  return {
    card: "border-red-200 bg-red-50/80 shadow-red-100 dark:border-red-400/30 dark:bg-red-400/10 dark:shadow-none",
    text: "text-red-700 dark:text-red-300",
  };
}

function evidenceLabel(source: ConcreteIssue["evidenceSource"]) {
  if (source === "pdf-visual") return "PDF visual";
  if (source === "pdf-text") return "PDF text";
  if (source === "docx-structure") return "DOCX structure";
  return "Google Docs structure";
}

function toneBoxClass(tone: ConcreteIssue["annotation"]["tone"]) {
  if (tone === "text") return "border-red-500 bg-red-500/10";
  if (tone === "layout") return "border-amber-500 bg-amber-400/15";
  return "border-purple-500 bg-purple-500/10";
}

function toneMarkerClass(tone: ConcreteIssue["annotation"]["tone"]) {
  if (tone === "text") return "bg-red-600";
  if (tone === "layout") return "bg-amber-600";
  return "bg-purple-700";
}

function toneLabelClass(tone: ConcreteIssue["annotation"]["tone"]) {
  if (tone === "text") return "bg-red-50 text-red-800 ring-1 ring-red-200";
  if (tone === "layout") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  return "bg-purple-50 text-purple-900 ring-1 ring-purple-200";
}

function isPdf(file: File | null) {
  return file?.name.toLowerCase().endsWith(".pdf") ?? false;
}

function validateUpload(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "docx"].includes(extension)) {
    return "Accepted formats: PDF, DOCX.";
  }
  if (file.size > maxSize) {
    return "Maximum file size is 15 MB.";
  }
  return "";
}

function formatSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const controlButtonClass =
  "rounded-lg bg-surface-muted px-3 py-2 text-xs font-black text-muted-strong transition hover:bg-surface-raised hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";

const iconButtonClass =
  "grid h-9 w-9 place-items-center rounded-lg bg-surface-muted text-muted-strong transition hover:bg-surface-raised hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";
