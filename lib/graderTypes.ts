export type CategoryScore = {
  name: string;
  points: number;
  maxPoints: number;
  notes: string[];
  deductions: string[];
};

export type IssueSeverity = "high" | "medium" | "low";
export type IssueConfidence = "high" | "medium" | "low";
export type IssueImpact = "high" | "medium" | "low";
export type EvidenceSource = "pdf-visual" | "pdf-text" | "docx-structure" | "gdoc-structure";

export type NormalizedBox = AnnotationRegion;

export type DocumentObjectType =
  | "chart"
  | "table"
  | "figure"
  | "caption"
  | "image"
  | "diagram"
  | "heading"
  | "list"
  | "rule"
  | "signature"
  | "form";

export type DocumentObject = {
  id: string;
  type: DocumentObjectType;
  page: number;
  label?: string;
  text?: string;
  box?: NormalizedBox;
  confidence: IssueConfidence;
};

export type IdentityCheckResult = {
  isLikelySameDocument: boolean;
  confidence: "high" | "medium" | "low";
  titleSimilarity: number;
  keywordOverlap: number;
  headingOverlap: number;
  contentCoverage: number;
  semanticSimilarity?: number;
  reason: string;
  originalTitle: string;
  recreatedTitle: string;
  objectMismatch: boolean;
};

export type IssueType =
  | "missing-text"
  | "extra-text"
  | "text-changed"
  | "wrong-order"
  | "heading-mismatch"
  | "list-mismatch"
  | "table-visual-mismatch"
  | "table-structure-uncertain"
  | "table-count-mismatch"
  | "table-layout-differs"
  | "table-not-native"
  | "object-mismatch"
  | "source-intent-mismatch"
  | "layout-mismatch"
  | "possible-image-text";

export type DocumentBlockKind = "heading" | "paragraph" | "list" | "table" | "image";

export type DocumentBlock = {
  id: string;
  pageNumber: number;
  order: number;
  kind: DocumentBlockKind;
  text: string;
  issueIds: string[];
  bounds: AnnotationRegion;
};

export type DocumentPreviewPage = {
  pageNumber: number;
  width: number;
  height: number;
  blocks: DocumentBlock[];
};

export type DocumentPreview = {
  fileName: string;
  fileType: "pdf" | "docx";
  renderingMode: "pdf" | "pdf-fallback";
  pdfDataUrl?: string;
  conversionNotice?: string;
  pages: DocumentPreviewPage[];
};

export type AnnotationTone = "text" | "structure" | "layout";

export type AnnotationRegion = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  placeholder?: boolean;
};

export type IssueAnnotation = {
  label: string;
  fixLabel: string;
  tone: AnnotationTone;
  original?: AnnotationRegion;
  recreated?: AnnotationRegion;
};

export type ConcreteIssue = {
  id: string;
  severity: IssueSeverity;
  confidence: IssueConfidence;
  impact: IssueImpact;
  evidenceSource: EvidenceSource;
  type: IssueType;
  title: string;
  location: string;
  originalExcerpt: string;
  recreatedExcerpt: string;
  explanation: string;
  fix: string;
  pageNumber: number;
  originalBlockIds: string[];
  recreatedBlockIds: string[];
  annotation: IssueAnnotation;
  scoreImpact: {
    category: string;
    pointsLost: number;
  };
};

export type GradeResult = {
  overallScore: number;
  status?: string;
  identityCheck?: IdentityCheckResult;
  metrics: {
    visualMatch: number;
    contentCoverage: number;
  };
  categoryScores: CategoryScore[];
  issues: ConcreteIssue[];
  prioritizedFixes: string[];
  verdict: string;
  previews: {
    original: DocumentPreview;
    recreated: DocumentPreview;
  };
};
