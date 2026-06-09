export type Rule = {
  id: string;
  title: string;
  do: string;
  dont: string;
  example?: string;
};

export const rules: Rule[] = [
  {
    id: "start-from-blank-doc",
    title: "Start from a blank Google Doc",
    do: "Use the source file as a visual reference and rebuild the document manually.",
    dont: "Do not use a direct DOCX import as the final recreated document.",
    example: "Open a blank Doc, then recreate headings, paragraphs, tables, charts, and page elements natively.",
  },
  {
    id: "tables-native",
    title: "Recreate tables as tables",
    do: "Use Insert → Table and rebuild rows, columns, borders, shading, alignment, and text.",
    dont: "Do not screenshot a table that contains editable text or data.",
    example: "A colored header row should be a Docs table with cell background color, not an image.",
  },
  {
    id: "charts-native",
    title: "Recreate charts natively when possible",
    do: "Use Insert → Chart and recreate the visible chart data, labels, legend, and colors.",
    dont: "Do not flatten a chart into a screenshot when a native chart is expected.",
    example: "A bar chart should become an embedded Docs chart with matching categories and values.",
  },
  {
    id: "diagrams-drawings",
    title: "Use drawings for diagrams",
    do: "Use Insert → Drawing → New for flowcharts, shape diagrams, arrows, and visual processes.",
    dont: "Do not recreate editable diagrams as pasted screenshots.",
    example: "A process map with boxes and arrows should become an in-Doc drawing.",
  },
  {
    id: "true-images",
    title: "Keep true images as images",
    do: "Use images for photos, logos, scans, and bitmap content.",
    dont: "Do not use images for editable text, tables, charts, or diagrams.",
    example: "A photo stays an image; a table shown beside it becomes a native table.",
  },
  {
    id: "headings-native",
    title: "Use heading styles for headings",
    do: "Apply Title, Heading 1, Heading 2, and Heading 3 from the styles dropdown.",
    dont: "Do not make headings with only manual bold and font size.",
    example: "A section title should appear in the document outline after styling.",
  },
  {
    id: "spacing-formatting",
    title: "Use layout tools for spacing",
    do: "Use paragraph spacing, indents, tabs, page breaks, columns, or layout tables.",
    dont: "Do not align content with repeated spaces or blank lines.",
    example: "Use Insert → Break → Page break instead of pressing Enter until a new page appears.",
  },
  {
    id: "headers-footers-page-numbers",
    title: "Use native page elements",
    do: "Use native headers, footers, footnotes, and page numbers.",
    dont: "Do not manually type repeated content on every page.",
    example: "Page numbers should be inserted with Insert → Page numbers.",
  },
  {
    id: "links-clickable",
    title: "Keep links functional",
    do: "Use Insert link / Ctrl+K for URLs, emails, and internal jumps.",
    dont: "Do not leave linked source text as plain unclickable text.",
    example: "If the source has blue underlined URL text, recreate it as an actual link.",
  },
  {
    id: "do-not-change-meaning",
    title: "Improve form, not meaning",
    do: "Clean up spacing and readability while preserving source facts, order, numbers, and claims.",
    dont: "Do not rewrite, summarize, correct facts, or change meaning.",
    example: "Fix obvious formatting; do not change a figure because it looks suspicious.",
  },
  {
    id: "avoid-interactive-final-elements",
    title: "Avoid interactive final-only elements",
    do: "Use plain text or static native equivalents for final deliverables.",
    dont: "Do not leave comments, suggestions, smart chips, or dropdown chips in the final export.",
    example: "A status dropdown should become static text or a table cell value.",
  },
  {
    id: "handle-impossible-layouts",
    title: "Flag layouts with no clean native equivalent",
    do: "Preserve the intent with the closest native Google Docs structure and note the uncertainty through the official workflow.",
    dont: "Do not force fragile pixel tracing with screenshots, spaces, or hidden objects.",
    example: "A complex Word-only layout may need a clean native approximation.",
  },
];
