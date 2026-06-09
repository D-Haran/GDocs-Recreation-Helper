import mammoth from "mammoth";
import { execFile } from "child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import type {
  AnnotationRegion,
  CategoryScore,
  ConcreteIssue,
  DocumentBlock,
  DocumentBlockKind,
  DocumentObject,
  DocumentObjectType,
  DocumentPreview,
  EvidenceSource,
  GradeResult,
  IdentityCheckResult,
  IssueConfidence,
  IssueImpact,
  IssueType,
} from "@/lib/graderTypes";

const execFileAsync = promisify(execFile);

type UploadedGradeFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type DocumentModel = DocumentPreview & {
  text: string;
  normalizedText: string;
  words: string[];
  hasExtractableText: boolean;
  structureEvidenceSource: EvidenceSource;
  objectInventory: DocumentObject[];
};

type NormalizedUpload = {
  name: string;
  fileType: "pdf" | "docx";
  sourceBuffer: Buffer;
  pdfPath: string;
  pdfBuffer: Buffer;
  pdfDataUrl?: string;
  conversionNotice?: string;
  conversionLog?: ConversionLog;
};

type BlockMatch = {
  original: DocumentBlock;
  recreated: DocumentBlock;
  similarity: number;
};

type ConversionLog = {
  uploadedFilename: string;
  detectedMimeType: string;
  detectedExtension: string;
  tempInputPath: string;
  tempOutputDir: string;
  inputExists: boolean;
  inputSize: number;
  libreOfficeBinaryPath: string | null;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  filesCreatedInOutputDir: string[];
  expectedOutputPdfPath: string;
  expectedOutputPdfExists: boolean;
};

type NormalizedPdf = {
  originalName: string;
  inputType: "pdf" | "docx";
  sourceBuffer: Buffer;
  pdfPath: string;
  pdfBytes: Buffer;
  conversionLog?: ConversionLog;
};

type FileDetection = {
  extension: string;
  inputType: "pdf" | "docx";
};

export class GradeApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly debugHint?: string,
  ) {
    super(message);
    this.name = "GradeApiError";
  }
}

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const acceptedExtensions = new Set(["pdf", "docx"]);
const maxIssues = 24;
const goldenSampleCalibration = {
  name: "Native Google Docs recreation golden samples",
  acceptedMinorDifferences: ["spacing", "line wrapping", "page breaks", "font approximation", "minor punctuation"],
  prioritySignals: ["content preserved", "organization preserved", "native/editable objects", "reasonable visual similarity"],
  minorVisualPenaltyCap: 2,
};

export async function gradeRecreation(originalFile: UploadedGradeFile, recreatedFile: UploadedGradeFile): Promise<GradeResult> {
  validateFile(originalFile);
  validateFile(recreatedFile);

  const tempDir = await mkdtemp(path.join(tmpdir(), "gdocs-grader-"));

  try {
    const [original, recreated] = await Promise.all([extractDocumentModel(originalFile, tempDir), extractDocumentModel(recreatedFile, tempDir)]);
    const identityCheck = runDocumentIdentityCheck(original, recreated);
    if (!identityCheck.isLikelySameDocument) {
      return unrelatedDocumentsResult(original, recreated, identityCheck);
    }

    const comparison = compareDocuments(original, recreated);
    const metrics = {
      contentCoverage: contentCoverageScore(original, recreated),
      visualMatch: visualSimilarityScore(original, recreated),
    };
    const categoryScores = scoreFromIssues(original, recreated, comparison.issues, metrics);
    const overallScore = capOverallScore(categoryScores.reduce((sum, category) => sum + category.points, 0), metrics, original, recreated);

    return {
      overallScore,
      metrics,
      categoryScores,
      issues: comparison.issues.length ? comparison.issues : [noMajorIssue()],
      prioritizedFixes: generatePrioritizedFixes(comparison.issues, categoryScores),
      verdict: verdictForScore(overallScore),
      status: "Recreation graded",
      identityCheck,
      previews: {
        original: attachIssues(original, comparison.issues, "original"),
        recreated: attachIssues(recreated, comparison.issues, "recreated"),
      },
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function extractDocumentModel(file: UploadedGradeFile, tempDir?: string): Promise<DocumentModel> {
  const ownedTempDir = tempDir ? null : await mkdtemp(path.join(tmpdir(), "gdocs-grader-"));

  try {
    const normalized = await normalizeUploadToPdf(file, tempDir ?? ownedTempDir!);

    if (normalized.fileType === "docx") {
      return extractDocxModel(normalized);
    }

    return extractPdfModel(normalized);
  } finally {
    if (ownedTempDir) {
      await rm(ownedTempDir, { recursive: true, force: true });
    }
  }
}

export function compareTextBlocks(original: DocumentModel, recreated: DocumentModel) {
  const originalBlocks = allBlocks(original);
  const recreatedBlocks = allBlocks(recreated);
  const usedRecreated = new Set<string>();
  const matches: BlockMatch[] = [];
  const missing: DocumentBlock[] = [];

  for (const originalBlock of originalBlocks) {
    const best = bestMatch(originalBlock, recreatedBlocks.filter((block) => !usedRecreated.has(block.id)));
    if (!best || best.similarity < 0.42) {
      missing.push(originalBlock);
      continue;
    }

    usedRecreated.add(best.block.id);
    matches.push({ original: originalBlock, recreated: best.block, similarity: best.similarity });
  }

  const extra = recreatedBlocks.filter((block) => !usedRecreated.has(block.id));
  return { matches, missing, extra };
}

export function compareStructure(original: DocumentModel, recreated: DocumentModel) {
  const originalBlocks = allBlocks(original);
  const recreatedBlocks = allBlocks(recreated);
  const originalTableCount = logicalTableCount(original);
  const recreatedTableCount = logicalTableCount(recreated);
  return {
    headingCount: [countKind(originalBlocks, "heading"), countKind(recreatedBlocks, "heading")] as const,
    listCount: [countKind(originalBlocks, "list"), countKind(recreatedBlocks, "list")] as const,
    tableCount: [originalTableCount, recreatedTableCount] as const,
  };
}

export function compareVisualLayout(original: DocumentModel, recreated: DocumentModel) {
  return {
    pageCount: [original.pages.length, recreated.pages.length] as const,
    blockCount: [allBlocks(original).length, allBlocks(recreated).length] as const,
    averageBlockLength: [averageBlockLength(original), averageBlockLength(recreated)] as const,
    extractableRatio: recreated.words.length / Math.max(original.words.length, 1),
  };
}

function contentCoverageScore(original: DocumentModel, recreated: DocumentModel) {
  if (!original.hasExtractableText || !recreated.hasExtractableText) return 0;
  const sourceWords = meaningfulWords(original.text);
  if (!sourceWords.length && !original.objectInventory.length) return 0;
  const sourcePhrases = phraseSet(sourceWords, 3);
  const recreatedWordsList = meaningfulWords(recreated.text);
  let textCoverage = 0;
  if (!sourcePhrases.size) {
    const recreatedWords = new Set(recreatedWordsList);
    textCoverage = sourceWords.length ? sourceWords.filter((word) => recreatedWords.has(word)).length / sourceWords.length : 1;
  } else {
    const recreatedPhrases = phraseSet(recreatedWordsList, 3);
    const covered = Array.from(sourcePhrases).filter((phrase) => recreatedPhrases.has(phrase)).length;
    const phraseCoverage = covered / sourcePhrases.size;

    const recreatedWords = new Set(recreatedWordsList);
    const wordCoverage = sourceWords.length ? sourceWords.filter((word) => recreatedWords.has(word)).length / sourceWords.length : 1;
    textCoverage = phraseCoverage * 0.7 + wordCoverage * 0.3;
  }

  const objectCoverage = objectCoverageScore(original, recreated);
  const captionCoverage = captionCoverageScore(original, recreated);
  const hasMajorObjects = majorObjects(original.objectInventory).length > 0;
  const weights = hasMajorObjects
    ? { text: 0.55, object: 0.35, caption: 0.1 }
    : { text: 0.65, object: 0.25, caption: 0.1 };

  return Math.round(((textCoverage * weights.text) + (objectCoverage * weights.object) + (captionCoverage * weights.caption)) * 100);
}

function visualSimilarityScore(original: DocumentModel, recreated: DocumentModel) {
  const layout = compareVisualLayout(original, recreated);
  const pageScore = ratioScore(layout.pageCount[0], layout.pageCount[1]);
  const blockScore = ratioScore(layout.blockCount[0], layout.blockCount[1]);
  const lengthScore = ratioScore(Math.round(layout.averageBlockLength[0]), Math.round(layout.averageBlockLength[1]));
  const structureScore = structureSimilarity(original, recreated);
  const coverage = contentCoverageScore(original, recreated) / 100;
  const visualObjectScore = visualObjectSimilarity(original, recreated);
  const rawScore = Math.round((pageScore * 0.08 + blockScore * 0.1 + lengthScore * 0.08 + structureScore * 0.14 + visualObjectScore * 0.25 + coverage * 0.35) * 100);
  if (!original.hasExtractableText || !recreated.hasExtractableText) return Math.min(rawScore, 25);
  if (coverage < 0.15) return Math.min(rawScore, 30);
  if (coverage < 0.35) return Math.min(rawScore, 45);
  if (coverage < 0.55) return Math.min(rawScore, 60);
  if (visualObjectScore < 0.5 && majorObjects(original.objectInventory).length) return Math.min(rawScore, 72);
  return rawScore;
}

function structureSimilarity(original: DocumentModel, recreated: DocumentModel) {
  const originalBlocks = allBlocks(original);
  const recreatedBlocks = allBlocks(recreated);
  const kinds: DocumentBlockKind[] = ["heading", "list", "table", "image", "paragraph"];
  const scores = kinds.map((kind) => ratioScore(countKind(originalBlocks, kind), countKind(recreatedBlocks, kind)));
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function generateConcreteIssues(original: DocumentModel, recreated: DocumentModel, matches: BlockMatch[], missing: DocumentBlock[], extra: DocumentBlock[]): ConcreteIssue[] {
  const issues: ConcreteIssue[] = [];
  const coverage = contentCoverageScore(original, recreated);
  const recreatedMeaningfulText = meaningfulText(recreated.text);
  const recreatedHasNativeEvidence = hasNativeStructureEvidence(recreated);
  const structureEvidence = recreatedHasNativeEvidence ? recreated.structureEvidenceSource : "pdf-text";

  if (!original.hasExtractableText || !recreated.hasExtractableText) {
    issues.push(makeLayoutIssue(
      "Text could not be compared",
      !original.hasExtractableText && !recreated.hasExtractableText
        ? "Neither PDF exposed extractable text, so placeholder preview text was excluded from scoring."
        : !original.hasExtractableText
          ? "The original PDF did not expose extractable text, so content overlap could not be trusted."
          : "The recreated PDF did not expose extractable text, so content overlap could not be trusted.",
      "Export PDFs with selectable text, or upload DOCX files when available, so the grader can compare real document content.",
      12,
      "possible-image-text",
      "high",
      "Content preservation",
      "high",
      "high",
      "pdf-text",
    ));
  }

  for (const block of missing.filter((block) => shouldFlagMissingBlock(block, recreatedMeaningfulText, coverage)).slice(0, 5)) {
    issues.push(makeIssue({
      type: block.kind === "heading" ? "heading-mismatch" : "missing-text",
      title: block.kind === "heading" ? "Heading style missing" : "Missing section",
      original: block,
      recreated: null,
      severity: block.kind === "heading" ? "high" : "medium",
      explanation: "Meaningful source content was not found in the recreated file.",
      fix: fixForMissing(block),
      category: "Content preservation",
      pointsLost: block.kind === "heading" ? 2 : 5,
      confidence: coverage >= 88 ? "medium" : "high",
      impact: block.kind === "heading" ? "medium" : "high",
      evidenceSource: "pdf-text",
    }));
  }

  for (const block of extra.filter((block) => shouldFlagExtraBlock(block, original)).slice(0, 2)) {
    issues.push(makeIssue({
      type: "extra-text",
      title: "Extra content",
      original: null,
      recreated: block,
      severity: "low",
      explanation: "This block does not clearly belong to the source document.",
      fix: "Remove it only if it changes the source content or document intent.",
      category: "Content preservation",
      pointsLost: 0,
      confidence: "low",
      impact: "low",
      evidenceSource: "pdf-text",
    }));
  }

  const orderIssues: ConcreteIssue[] = [];
  for (const match of matches) {
    if (issues.length >= maxIssues) break;
    if (match.similarity < 0.52 && contentMeaningChanged(match.original.text, match.recreated.text)) {
      issues.push(makeIssue({
        type: "text-changed",
        title: "Meaning changed",
        original: match.original,
        recreated: match.recreated,
        severity: match.similarity < 0.52 ? "high" : "medium",
        explanation: "The recreated text appears to change the source meaning.",
        fix: "Restore the source meaning and any important names, numbers, or claims.",
        category: "Content preservation",
        pointsLost: 4,
        confidence: "medium",
        impact: "high",
        evidenceSource: "pdf-text",
      }));
    }
    if (match.original.kind !== match.recreated.kind && match.original.kind !== "paragraph") {
      const originalKind = match.original.kind;
      const pdfOnlyStructure = !recreatedHasNativeEvidence;
      issues.push(makeIssue({
        type: structureIssueType(originalKind, pdfOnlyStructure),
        title: structureIssueTitle(originalKind, pdfOnlyStructure),
        original: match.original,
        recreated: match.recreated,
        severity: pdfOnlyStructure ? "medium" : "high",
        explanation: structureIssueExplanation(originalKind, pdfOnlyStructure),
        fix: fixForStructure(originalKind, pdfOnlyStructure),
        category: pdfOnlyStructure ? "Organization and structure" : "Native Google Docs functionality",
        pointsLost: pdfOnlyStructure ? (originalKind === "table" ? 2 : 1) : originalKind === "table" ? 5 : 3,
        confidence: pdfOnlyStructure ? "low" : "medium",
        impact: pdfOnlyStructure ? "medium" : originalKind === "table" ? "high" : "medium",
        evidenceSource: pdfOnlyStructure ? "pdf-text" : structureEvidence,
      }));
    }
    if (coverage < 88 && Math.abs(match.original.order - match.recreated.order) > 6 && match.similarity > 0.82) {
      orderIssues.push(makeIssue({
        type: "wrong-order",
        title: "Section order needs review",
        original: match.original,
        recreated: match.recreated,
        severity: "medium",
        explanation: "The same content appears in a different document order.",
        fix: "Move this block so the document order matches the source.",
        category: "Organization and structure",
        pointsLost: 2,
        confidence: "medium",
        impact: "medium",
        evidenceSource: "pdf-text",
      }));
    }
  }
  if (orderIssues.length) issues.push(groupOrderIssues(orderIssues));

  const structure = compareStructure(original, recreated);
  if (recreatedHasNativeEvidence) {
    addCountIssue(issues, structure.headingCount, "heading-mismatch", "Heading style missing", "Organization and structure", "Apply Title or Heading styles so the document outline works.", "medium", "medium", recreated.structureEvidenceSource);
    addCountIssue(issues, structure.listCount, "list-mismatch", "List not native", "Native Google Docs functionality", "Use native bullets or numbering instead of typed markers.", "medium", "medium", recreated.structureEvidenceSource);
    addCountIssue(issues, structure.tableCount, "table-count-mismatch", "Table count mismatch", "Native Google Docs functionality", "Verify the DOCX table count and rebuild any missing native table cells.", structure.tableCount[0] > 0 && structure.tableCount[1] === 0 ? "high" : "medium", "high", recreated.structureEvidenceSource);
  } else {
    addPdfStructureCountIssues(issues, structure);
  }

  const layout = compareVisualLayout(original, recreated);
  if (coverage < 75) {
    issues.push(makeLayoutIssue("Missing source content", `${coverage}% of meaningful source content was detected in the recreation.`, "Review the source and add any missing sections or important lines.", Math.min(8, Math.ceil((75 - coverage) / 5)), "missing-text", "high", "Content preservation", "high", "high"));
  }
  if (Math.abs(layout.pageCount[0] - layout.pageCount[1]) > 1) {
    issues.push(makeLayoutIssue("Page flow changed", `Source has ${layout.pageCount[0]} page preview(s); recreation has ${layout.pageCount[1]}.`, "Check only for missing sections or major layout grouping issues.", 0, "layout-mismatch", "low", "Visual polish", "low", "low"));
  }
  if (coverage < 84 && ratioScore(layout.blockCount[0], layout.blockCount[1]) < 0.5) {
    issues.push(makeLayoutIssue("Major structure difference", `Source has ${layout.blockCount[0]} text blocks; recreation has ${layout.blockCount[1]}.`, "Check for missing sections, flattened tables, or broken grouping.", 3, "layout-mismatch", "medium", "Organization and structure", "medium", "medium"));
  }
  if (layout.extractableRatio < 0.55) {
    const pdfOnly = !recreatedHasNativeEvidence;
    issues.push(makeLayoutIssue(
      pdfOnly ? "Text extraction unclear" : "Text appears non-editable",
      pdfOnly ? "The recreated PDF exposes much less selectable text than the source, but PDF extraction cannot prove whether the Google Doc text is editable." : "The recreation has much less extractable text than the source.",
      pdfOnly ? "Check the exported PDF and the editable Google Doc for missing selectable text or flattened visual content." : "Make document content editable with native text, tables, charts, or drawings.",
      pdfOnly ? 2 : 8,
      "possible-image-text",
      pdfOnly ? "medium" : "high",
      pdfOnly ? "Content preservation" : "Native Google Docs functionality",
      pdfOnly ? "low" : "high",
      pdfOnly ? "medium" : "high",
      "pdf-text",
    ));
  }

  addObjectRecreationIssues(issues, original, recreated);

  return groupIssues(issues).slice(0, maxIssues).map((issue, index) => ({
    ...issue,
    id: `issue-${index + 1}`,
    originalBlockIds: issue.originalBlockIds,
    recreatedBlockIds: issue.recreatedBlockIds,
  }));
}

function compareDocuments(original: DocumentModel, recreated: DocumentModel) {
  const { matches, missing, extra } = compareTextBlocks(original, recreated);
  const issues = generateConcreteIssues(original, recreated, matches, missing, extra);
  return { matches, missing, extra, issues };
}

function runDocumentIdentityCheck(original: DocumentModel, recreated: DocumentModel): IdentityCheckResult {
  const originalTitle = extractDocumentTitle(original);
  const recreatedTitle = extractDocumentTitle(recreated);
  const titleSimilarity = originalTitle && recreatedTitle ? textSimilarity(originalTitle, recreatedTitle) : 0;
  const originalKeywords = topKeywords(original.text, 28);
  const recreatedKeywords = topKeywords(recreated.text, 28);
  const keywordOverlap = overlapRatio(originalKeywords, recreatedKeywords);
  const originalHeadings = sectionHeadings(original);
  const recreatedHeadings = sectionHeadings(recreated);
  const headingOverlap = overlapRatio(originalHeadings, recreatedHeadings);
  const contentCoverage = contentCoverageScore(original, recreated) / 100;
  const semanticSimilarity = (keywordOverlap * 0.45) + (contentCoverage * 0.35) + (headingOverlap * 0.2);
  const originalObjects = objectSignals(original.normalizedText);
  const recreatedObjects = new Set(objectSignals(recreated.normalizedText));
  const missingObjects = originalObjects.filter((object) => !recreatedObjects.has(object));
  const objectMismatch = originalObjects.length > 0 && missingObjects.length > 0;

  const hardFailures = [
    titleSimilarity < 0.25,
    keywordOverlap < 0.2,
    headingOverlap < 0.15,
    contentCoverage < 0.2,
    semanticSimilarity < 0.25,
    objectMismatch,
  ].filter(Boolean).length;
  const pageCountVeryDifferent = ratioScore(original.pages.length, recreated.pages.length) < 0.45;
  const likelyWrongFile = hardFailures >= 2 || (contentCoverage < 0.2 && (titleSimilarity < 0.2 || keywordOverlap < 0.2 || pageCountVeryDifferent));
  const confidence: IdentityCheckResult["confidence"] = likelyWrongFile
    ? hardFailures >= 4 || (contentCoverage < 0.12 && keywordOverlap < 0.16) ? "high" : "medium"
    : hardFailures === 1 ? "low" : "high";

  return {
    isLikelySameDocument: !likelyWrongFile,
    confidence,
    titleSimilarity: percent(titleSimilarity),
    keywordOverlap: percent(keywordOverlap),
    headingOverlap: percent(headingOverlap),
    contentCoverage: percent(contentCoverage),
    semanticSimilarity: percent(semanticSimilarity),
    reason: likelyWrongFile
      ? "The source and recreated files have different titles, sections, content, and document objects."
      : "The source and recreated files passed the document identity preflight.",
    originalTitle: originalTitle || "No clear source title found",
    recreatedTitle: recreatedTitle || "No clear recreated title found",
    objectMismatch,
  };
}

function unrelatedDocumentsResult(original: DocumentModel, recreated: DocumentModel, identityCheck: IdentityCheckResult): GradeResult {
  const maxScore = identityCheck.confidence === "high" ? 10 : 20;
  const overlapScore = Math.round((identityCheck.contentCoverage * 0.45) + (identityCheck.keywordOverlap * 0.3) + (identityCheck.headingOverlap * 0.15) + (identityCheck.titleSimilarity * 0.1));
  const score = Math.min(maxScore, identityCheck.contentCoverage < 20 ? 15 : maxScore, overlapScore);
  const issue = makeLayoutIssue(
    "Uploaded recreation does not match the source document",
    "The source and recreated files have different titles, sections, content, and document objects.",
    "Upload the correct recreated export for this source file.",
    30,
    "missing-text",
    "high",
    "Content preservation",
    identityCheck.confidence,
    "high",
    "pdf-text",
  );

  return {
    overallScore: score,
    status: "Wrong file / unrelated document",
    identityCheck,
    metrics: {
      contentCoverage: identityCheck.contentCoverage,
      visualMatch: Math.min(20, identityCheck.semanticSimilarity ?? 0),
    },
    categoryScores: [
      {
        name: "Content preservation",
        points: 0,
        maxPoints: 30,
        notes: ["These appear to be different documents."],
        deductions: ["Wrong file likely: source content was not found in the recreation."],
      },
      {
        name: "Organization and structure",
        points: 0,
        maxPoints: 20,
        notes: [`Heading overlap: ${identityCheck.headingOverlap}%.`],
        deductions: ["Normal structure grading skipped because the document identity check failed."],
      },
      {
        name: "Native Google Docs functionality",
        points: 0,
        maxPoints: 25,
        notes: ["Native object grading skipped because the uploaded files appear unrelated."],
        deductions: [],
      },
      {
        name: "Object recreation quality",
        points: 0,
        maxPoints: 15,
        notes: [identityCheck.objectMismatch ? "Major source objects do not correspond." : "Object correspondence was not enough to pass identity preflight."],
        deductions: [],
      },
      {
        name: "Visual polish",
        points: Math.min(10, score),
        maxPoints: 10,
        notes: ["Generic visual formatting cannot lift an unrelated document score."],
        deductions: [],
      },
    ],
    issues: [{ ...issue, id: "issue-1" }],
    prioritizedFixes: ["Upload the correct recreated export for this source file."],
    verdict: "Wrong file / unrelated document",
    previews: {
      original: attachIssues(original, [issue], "original"),
      recreated: attachIssues(recreated, [issue], "recreated"),
    },
  };
}

function scoreFromIssues(original: DocumentModel, recreated: DocumentModel, issues: ConcreteIssue[], metrics: GradeResult["metrics"]): CategoryScore[] {
  const categoryMax = {
    "Content preservation": 30,
    "Organization and structure": 20,
    "Native Google Docs functionality": 25,
    "Object recreation quality": 15,
    "Visual polish": 10,
  };
  const deductions = new Map<string, string[]>();
  const pointsLost = new Map<string, number>();

  for (const issue of issues) {
    const category = issue.scoreImpact.category;
    const loss = adjustedIssuePenalty(issue);
    if (loss <= 0) continue;
    pointsLost.set(category, (pointsLost.get(category) ?? 0) + loss);
    const items = deductions.get(category) ?? [];
    items.push(`-${loss} ${issue.title.toLowerCase()} on page ${issue.pageNumber}`);
    deductions.set(category, items);
  }

  const extractableRatio = recreated.words.length / Math.max(original.words.length, 1);
  if (metrics.contentCoverage < 90) {
    addDeduction(pointsLost, deductions, "Content preservation", Math.min(22, Math.ceil((90 - metrics.contentCoverage) / 2.5)), "meaningful source content coverage is low");
  }
  if (extractableRatio < 0.55 && metrics.contentCoverage < 75) {
    if (hasNativeStructureEvidence(recreated)) {
      addDeduction(pointsLost, deductions, "Native Google Docs functionality", 6, "low extractable recreated text");
    } else {
      addDeduction(pointsLost, deductions, "Content preservation", 2, "low PDF text extraction confidence");
    }
  }
  applyGoldenCalibration(pointsLost, deductions, original, recreated, issues);

  const scores = Object.entries(categoryMax).map(([name, maxPoints]) => {
    const lost = Math.min(maxPoints, pointsLost.get(name) ?? 0);
    const categoryDeductions = deductions.get(name) ?? [];
    return {
      name,
      maxPoints,
      points: Math.max(0, maxPoints - lost),
      deductions: categoryDeductions,
      notes: notesForCategory(name, original, recreated, categoryDeductions),
    };
  });
  return applyScoreGuardrails(scores, issues, metrics);
}

function capOverallScore(score: number, metrics: GradeResult["metrics"], original: DocumentModel, recreated: DocumentModel) {
  const metricComposite = Math.round((metrics.visualMatch + metrics.contentCoverage) / 2);
  const metricBoundedScore = Math.min(score, metricComposite);

  if (!original.hasExtractableText || !recreated.hasExtractableText) return Math.min(metricBoundedScore, 35);
  if (metrics.contentCoverage < 10) return Math.min(metricBoundedScore, 30);
  if (metrics.contentCoverage < 25) return Math.min(metricBoundedScore, 45);
  if (metrics.contentCoverage < 50) return Math.min(metricBoundedScore, 60);
  return metricBoundedScore;
}

function notesForCategory(name: string, original: DocumentModel, recreated: DocumentModel, deductions: string[]) {
  if (deductions.length) return deductions.slice(0, 3);
  if (name === "Content preservation") return ["No missing, extra, or meaning-changing text issues were detected."];
  if (name === "Organization and structure") return ["Section order, headings, and grouping look close at block level."];
  if (name === "Native Google Docs functionality") {
    if (!hasNativeStructureEvidence(recreated)) return ["Not directly verifiable from PDF export. Native table, list, and heading feedback is based on visual/text structure only."];
    return ["Editable DOCX structure was inspected for heading, list, and table patterns."];
  }
  if (name === "Object recreation quality") return [`Aligned with ${goldenSampleCalibration.name}: functional object form matters more than exact appearance.`];
  return [`Visual preview is for major layout inspection only: ${allBlocks(original).length} source blocks vs. ${allBlocks(recreated).length} recreated blocks.`];
}

function adjustedIssuePenalty(issue: ConcreteIssue) {
  if (issue.impact === "low" || issue.confidence === "low") return 0;
  if (issue.confidence === "high" && issue.impact === "high") return issue.scoreImpact.pointsLost;
  if (issue.confidence === "high" || issue.impact === "high") return Math.ceil(issue.scoreImpact.pointsLost * 0.65);
  return Math.ceil(issue.scoreImpact.pointsLost * 0.4);
}

function applyScoreGuardrails(scores: CategoryScore[], issues: ConcreteIssue[], metrics: GradeResult["metrics"]) {
  const seriousFailures = issues.some((issue) => issue.confidence === "high" && issue.impact === "high" && issue.scoreImpact.pointsLost >= 5);
  const currentTotal = scores.reduce((sum, category) => sum + category.points, 0);
  const minimum = metrics.visualMatch >= 82 && metrics.contentCoverage >= 90 && !seriousFailures ? 80 : metrics.visualMatch >= 76 && metrics.contentCoverage >= 88 && !seriousFailures ? 75 : 0;
  if (!minimum || currentTotal >= minimum) return scores;

  const gap = minimum - currentTotal;
  return scores.map((category) => {
    if (category.name !== "Visual polish" && category.name !== "Content preservation") return category;
    const add = category.name === "Content preservation" ? Math.ceil(gap * 0.7) : Math.floor(gap * 0.3);
    return {
      ...category,
      points: Math.min(category.maxPoints, category.points + add),
      notes: [`Guardrail applied: high content coverage (${metrics.contentCoverage}%) and visual match (${metrics.visualMatch}%).`],
    };
  });
}

function applyGoldenCalibration(pointsLost: Map<string, number>, deductions: Map<string, string[]>, original: DocumentModel, recreated: DocumentModel, issues: ConcreteIssue[]) {
  const functionalIssueCount = issues.filter((issue) => issue.scoreImpact.category !== "Visual polish").length;
  const visualLoss = pointsLost.get("Visual polish") ?? 0;
  const structurallyClose = ratioScore(allBlocks(original).length, allBlocks(recreated).length) >= 0.72;

  if (functionalIssueCount <= 1 && structurallyClose && visualLoss > goldenSampleCalibration.minorVisualPenaltyCap) {
    pointsLost.set("Visual polish", goldenSampleCalibration.minorVisualPenaltyCap);
    deductions.set("Visual polish", [`Minor visual differences capped by ${goldenSampleCalibration.name}.`]);
  }
}

function addObjectRecreationIssues(issues: ConcreteIssue[], original: DocumentModel, recreated: DocumentModel) {
  const sourceObjects = majorObjects(original.objectInventory);
  const recreatedObjects = majorObjects(recreated.objectInventory);
  const sourceIntent = omittedObjectIntents(original.text);
  const recreatedIntent = omittedObjectIntents(recreated.text);

  for (const object of sourceObjects) {
    if (hasComparableObject(object, recreatedObjects)) continue;
    issues.push(makeObjectIssue(
      object,
      null,
      object.type === "chart" ? "Chart missing" : object.type === "table" ? "Table missing" : object.type === "figure" ? "Figure object missing" : `${labelForObjectType(object.type)} missing`,
      `The source includes ${objectObjectLabel(object)}, but the recreation does not include a matching ${labelForObjectType(object.type).toLowerCase()} object.`,
      object.type === "chart"
        ? "Recreate chart or insert an appropriate visual object."
        : object.type === "table"
          ? "Use a native table or visually equivalent table structure."
          : "Recreate the figure visually/functionally.",
      10,
      "high",
      "high",
    ));
  }

  for (const object of recreatedObjects) {
    if (hasComparableObject(object, sourceObjects)) continue;
    const conflictsWithOmission = sourceIntent.some((intent) => objectMatchesIntent(object, intent));
    issues.push(makeObjectIssue(
      null,
      object,
      conflictsWithOmission
        ? object.type === "chart" ? "Extra chart added" : "Extra figure/chart added"
        : object.type === "chart" ? "Extra chart" : object.type === "table" ? "Extra table" : `Extra ${labelForObjectType(object.type).toLowerCase()}`,
      conflictsWithOmission
        ? `One document omits ${objectObjectLabel(object)} while the other includes the ${labelForObjectType(object.type).toLowerCase()} object.`
        : `The recreation includes ${objectObjectLabel(object)}, but the source does not include a matching ${labelForObjectType(object.type).toLowerCase()} object.`,
      conflictsWithOmission
        ? "Match the source: either recreate the chart if required, or remove it if the source says it was omitted."
        : "Remove extra object unless source requires it.",
      conflictsWithOmission ? 9 : 7,
      conflictsWithOmission ? "high" : "medium",
      "high",
      conflictsWithOmission ? "source-intent-mismatch" : "object-mismatch",
    ));
  }

  for (const intent of sourceIntent) {
    if (recreatedIntent.some((candidate) => candidate.type === intent.type && candidate.label === intent.label)) continue;
    const conflicting = recreatedObjects.find((object) => objectMatchesIntent(object, intent));
    if (!conflicting) continue;
    issues.push(makeObjectIssue(
      null,
      conflicting,
      "Source intent mismatch",
      `One document omits ${intent.label ?? intent.type} while the other includes that object.`,
      "Match whether the figure/object should exist.",
      9,
      "high",
      "high",
      "source-intent-mismatch",
    ));
  }

  const sourceCaptions = captions(original.objectInventory);
  const recreatedCaptions = captions(recreated.objectInventory);
  for (const caption of sourceCaptions) {
    const hasCaption = recreatedCaptions.some((candidate) => labelsCompatible(caption.label, candidate.label) || textSimilarity(caption.text ?? "", candidate.text ?? "") > 0.68);
    const hasPairedObject = hasObjectNearCaption(caption, recreatedObjects);
    if (hasCaption && !hasPairedObject && figureCaption(caption)) {
      issues.push(makeObjectIssue(
        caption,
        null,
        "Figure object missing",
        "The source has a figure caption paired with a visual object, but the recreation only appears to preserve the caption.",
        "Recreate the figure visually/functionally.",
        9,
        "high",
        "high",
      ));
    }
  }
}

type ObjectIntent = {
  type: DocumentObjectType;
  label?: string;
};

function detectDocumentObjects(model: Pick<DocumentModel, "pages" | "text">) {
  const objects: DocumentObject[] = [];
  const seen = new Set<string>();
  for (const block of allBlocks(model)) {
    const candidates: Array<Omit<DocumentObject, "id">> = [];
    if (block.kind === "heading") candidates.push({ type: "heading", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "medium" });
    if (block.kind === "list") candidates.push({ type: "list", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "medium" });
    if (block.kind === "table") candidates.push({ type: "table", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "medium" });

    const caption = captionObject(block);
    if (caption) candidates.push(caption);

    const visual = visualObjectFromText(block);
    if (visual) candidates.push(visual);

    if (horizontalRuleLike(block.text)) candidates.push({ type: "rule", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "low" });
    if (signatureLike(block.text)) candidates.push({ type: "signature", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "medium" });
    if (formLike(block.text)) candidates.push({ type: "form", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "medium" });
    if (calloutLike(block.text)) candidates.push({ type: "diagram", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "low" });

    for (const object of candidates) {
      const key = `${object.type}-${object.page}-${object.label ?? ""}-${normalizeText(object.text ?? "").slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      objects.push({ ...object, id: `object-${objects.length + 1}` });
    }
  }
  return coalesceDocumentObjects(objects);
}

function captionObject(block: DocumentBlock): Omit<DocumentObject, "id"> | null {
  const match = block.text.match(/^\s*((?:figure|fig\.?|table)\s*\d+[a-z]?)\b[:.\-\s]*(.*)$/i);
  if (!match) return null;
  const labelPrefix = match[1].toLowerCase().replace(/^fig\.?/, "figure").replace(/\s+/g, " ");
  return {
    type: "caption",
    page: block.pageNumber,
    label: labelPrefix,
    text: block.text,
    box: block.bounds,
    confidence: "high",
  };
}

function visualObjectFromText(block: DocumentBlock): Omit<DocumentObject, "id"> | null {
  const text = normalizeText(block.text);
  const caption = captionObject(block);
  if (omittedObjectIntents(block.text).length) return null;
  if (/\b(bar chart|line chart|pie chart|scatter plot|chart|graph|axis|axes|legend|series|x axis|y axis)\b/.test(text)) {
    return { type: "chart", page: block.pageNumber, label: caption?.label, text: block.text, box: block.bounds, confidence: /\b(chart|graph)\b/.test(text) ? "high" : "medium" };
  }
  if (caption?.label?.startsWith("figure")) {
    return { type: "figure", page: block.pageNumber, label: caption.label, text: block.text, box: block.bounds, confidence: "medium" };
  }
  if (/\b(image|photo|screenshot|illustration)\b/.test(text)) {
    return { type: "image", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "medium" };
  }
  if (/\b(diagram|flowchart|process map|arrow|shape)\b/.test(text)) {
    return { type: "diagram", page: block.pageNumber, text: block.text, box: block.bounds, confidence: "medium" };
  }
  return null;
}

function coalesceDocumentObjects(objects: DocumentObject[]) {
  const compact: DocumentObject[] = [];
  for (const object of objects) {
    if (object.type === "table" && compact.some((candidate) => candidate.type === "table" && samePageAndNear(candidate, object))) continue;
    if ((object.type === "chart" || object.type === "figure") && object.label && compact.some((candidate) => candidate.label === object.label && (candidate.type === "chart" || candidate.type === "figure"))) continue;
    compact.push(object);
  }
  return compact;
}

function samePageAndNear(a: DocumentObject, b: DocumentObject) {
  if (a.page !== b.page || !a.box || !b.box) return false;
  return Math.abs(a.box.y - b.box.y) < 0.09;
}

function majorObjects(objects: DocumentObject[]) {
  return objects.filter((object) => majorObjectTypes.has(object.type) && object.confidence !== "low");
}

const majorObjectTypes = new Set<DocumentObjectType>(["chart", "table", "figure", "image", "diagram", "signature", "form"]);

function captions(objects: DocumentObject[]) {
  return objects.filter((object) => object.type === "caption");
}

function captionCoverageScore(original: DocumentModel, recreated: DocumentModel) {
  const sourceCaptions = captions(original.objectInventory);
  if (!sourceCaptions.length) return 1;
  const recreatedCaptions = captions(recreated.objectInventory);
  const covered = sourceCaptions.filter((caption) => recreatedCaptions.some((candidate) => labelsCompatible(caption.label, candidate.label) || textSimilarity(caption.text ?? "", candidate.text ?? "") > 0.68));
  return covered.length / sourceCaptions.length;
}

function objectCoverageScore(original: DocumentModel, recreated: DocumentModel) {
  const sourceObjects = majorObjects(original.objectInventory);
  if (!sourceObjects.length) return majorObjects(recreated.objectInventory).length ? 0.8 : 1;
  const recreatedObjects = majorObjects(recreated.objectInventory);
  const covered = sourceObjects.filter((object) => hasComparableObject(object, recreatedObjects)).length;
  const extraPenalty = Math.min(0.35, Math.max(0, recreatedObjects.length - covered) * 0.12);
  return Math.max(0, (covered / sourceObjects.length) - extraPenalty);
}

function visualObjectSimilarity(original: DocumentModel, recreated: DocumentModel) {
  const sourceObjects = majorObjects(original.objectInventory);
  const recreatedObjects = majorObjects(recreated.objectInventory);
  if (!sourceObjects.length && !recreatedObjects.length) return 1;
  if (!sourceObjects.length || !recreatedObjects.length) return 0;
  const matched = sourceObjects.filter((object) => hasComparableObject(object, recreatedObjects, true)).length;
  const countScore = ratioScore(sourceObjects.length, recreatedObjects.length);
  return (matched / sourceObjects.length) * 0.72 + countScore * 0.28;
}

function hasComparableObject(object: DocumentObject, candidates: DocumentObject[], requireVisualAlignment = false) {
  return candidates.some((candidate) => objectsComparable(object, candidate, requireVisualAlignment));
}

function objectsComparable(a: DocumentObject, b: DocumentObject, requireVisualAlignment: boolean) {
  if (!sameObjectFamily(a.type, b.type)) return false;
  if (a.label || b.label) {
    if (!labelsCompatible(a.label, b.label)) return false;
  }
  if (requireVisualAlignment && a.box && b.box) {
    const nearPage = Math.abs(a.page - b.page) <= 1;
    const yAligned = Math.abs(a.box.y - b.box.y) < 0.22;
    const sizeAligned = ratioScore(Math.round(a.box.width * 100), Math.round(b.box.width * 100)) > 0.55;
    return nearPage && yAligned && sizeAligned;
  }
  return true;
}

function sameObjectFamily(a: DocumentObjectType, b: DocumentObjectType) {
  if (a === b) return true;
  const figureFamily = new Set<DocumentObjectType>(["chart", "figure", "image", "diagram"]);
  return figureFamily.has(a) && figureFamily.has(b);
}

function labelsCompatible(a?: string, b?: string) {
  if (!a || !b) return true;
  return normalizeText(a) === normalizeText(b);
}

function hasObjectNearCaption(caption: DocumentObject, objects: DocumentObject[]) {
  return objects.some((object) => {
    if (!sameObjectFamily(object.type, "figure")) return false;
    if (caption.label && object.label && !labelsCompatible(caption.label, object.label)) return false;
    if (caption.page !== object.page) return Math.abs(caption.page - object.page) <= 1;
    if (!caption.box || !object.box) return true;
    return Math.abs(caption.box.y - object.box.y) < 0.22;
  });
}

function figureCaption(caption: DocumentObject) {
  return Boolean(caption.label?.startsWith("figure"));
}

function omittedObjectIntents(text: string): ObjectIntent[] {
  const intents: ObjectIntent[] = [];
  const patterns = [
    /\b(figure|fig\.?|chart|graph|table|image|diagram)\s*(\d+[a-z]?)?\s+(?:was\s+|is\s+|were\s+|are\s+)?(?:omitted|removed|excluded|not included)\b/gi,
    /\b(?:omitted|removed|excluded)\s+(?:the\s+)?(figure|fig\.?|chart|graph|table|image|diagram)\s*(\d+[a-z]?)?\b/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const rawType = match[1].toLowerCase();
      const type = objectTypeFromIntent(rawType);
      const number = match[2]?.toLowerCase();
      intents.push({ type, label: number ? `${labelForObjectType(type).toLowerCase()} ${number}` : undefined });
    }
  }
  return Array.from(new Map(intents.map((intent) => [`${intent.type}-${intent.label ?? ""}`, intent])).values());
}

function objectTypeFromIntent(rawType: string): DocumentObjectType {
  if (rawType.startsWith("fig")) return "figure";
  if (rawType === "graph") return "chart";
  if (rawType === "table") return "table";
  if (rawType === "image") return "image";
  if (rawType === "diagram") return "diagram";
  return "chart";
}

function objectMatchesIntent(object: DocumentObject, intent: ObjectIntent) {
  if (!sameObjectFamily(object.type, intent.type) && object.type !== intent.type) return false;
  return !intent.label || labelsCompatible(intent.label, object.label);
}

function makeObjectIssue(
  original: DocumentObject | null,
  recreated: DocumentObject | null,
  title: string,
  explanation: string,
  fix: string,
  pointsLost: number,
  confidence: IssueConfidence,
  impact: IssueImpact,
  type: IssueType = "object-mismatch",
) {
  const object = original ?? recreated;
  const pageNumber = object?.page ?? 1;
  return {
    id: "issue-pending",
    severity: impact,
    confidence,
    impact,
    evidenceSource: "pdf-visual" as const,
    type,
    title,
    location: `Page ${pageNumber}, check ${object?.label ?? labelForObjectType(object?.type ?? "figure")}`,
    originalExcerpt: original?.text ?? "Not found",
    recreatedExcerpt: recreated?.text ?? "Not found",
    explanation,
    fix,
    pageNumber,
    originalBlockIds: [],
    recreatedBlockIds: [],
    annotation: {
      label: title,
      fixLabel: type === "source-intent-mismatch" ? "Match source" : original ? "Recreate object" : "Remove object",
      tone: "structure" as const,
      original: original?.box ?? placeholderRegion(recreated?.box, pageNumber) ?? documentRegion(pageNumber),
      recreated: recreated?.box ?? placeholderRegion(original?.box, pageNumber) ?? documentRegion(pageNumber),
    },
    scoreImpact: { category: "Object recreation quality", pointsLost },
  };
}

function labelForObjectType(type: DocumentObjectType) {
  if (type === "chart") return "Chart";
  if (type === "table") return "Table";
  if (type === "figure") return "Figure";
  if (type === "image") return "Image";
  if (type === "diagram") return "Diagram";
  if (type === "caption") return "Caption";
  if (type === "heading") return "Heading";
  if (type === "list") return "List";
  if (type === "rule") return "Horizontal rule";
  if (type === "signature") return "Signature line";
  return "Form";
}

function objectObjectLabel(object: DocumentObject) {
  return object.label ?? `a ${labelForObjectType(object.type).toLowerCase()}`;
}

function horizontalRuleLike(text: string) {
  return /^\s*[-_]{5,}\s*$/.test(text);
}

function signatureLike(text: string) {
  return /\b(signature|signed by|date signed)\b/i.test(text) || /_{5,}\s*(signature|date)?/i.test(text);
}

function formLike(text: string) {
  return /\b(checkbox|check box|form field|yes\s*\/\s*no)\b/i.test(text) || /\[[ x]\]/i.test(text);
}

function calloutLike(text: string) {
  return /\b(callout|note:|warning:|important:)\b/i.test(text);
}

function objectSignals(text: string) {
  const signals: string[] = [];
  if (/\b(chart|graph|axis|legend|series)\b/.test(text)) signals.push("chart");
  if (/\b(diagram|flowchart|process|arrow|shape)\b/.test(text)) signals.push("diagram");
  if (/\b(figure|image|photo|screenshot)\b/.test(text)) signals.push("image");
  return Array.from(new Set(signals));
}

async function normalizeUploadToPdf(file: UploadedGradeFile, tempDir: string): Promise<NormalizedUpload> {
  const normalized = await normalizeToPdf(file, tempDir);
  return {
    name: normalized.originalName,
    fileType: normalized.inputType,
    sourceBuffer: normalized.sourceBuffer,
    pdfPath: normalized.pdfPath,
    pdfBuffer: normalized.pdfBytes,
    pdfDataUrl: normalized.inputType === "docx" ? `data:application/pdf;base64,${normalized.pdfBytes.toString("base64")}` : undefined,
    conversionNotice: normalized.inputType === "docx" ? "DOCX was converted to PDF for visual preview." : undefined,
    conversionLog: normalized.conversionLog,
  };
}

async function normalizeToPdf(file: UploadedGradeFile, tempDir: string): Promise<NormalizedPdf> {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const detection = detectFileType(file, sourceBuffer);
  const safeName = ensureExtension(sanitizeFileName(file.name), detection.extension);
  const inputDir = path.join(tempDir, uniquePathPart(path.basename(safeName, path.extname(safeName))));
  const inputPath = path.resolve(inputDir, safeName);

  await mkdir(inputDir, { recursive: true });
  await writeFile(inputPath, sourceBuffer);

  const inputStat = await stat(inputPath);
  if (!inputStat.size) {
    throw new GradeApiError("EMPTY_UPLOAD", `${file.name} was uploaded as an empty file.`);
  }

  if (detection.inputType === "pdf") {
    return {
      originalName: file.name,
      inputType: "pdf",
      sourceBuffer,
      pdfPath: inputPath,
      pdfBytes: sourceBuffer,
    };
  }

  const { pdfPath, pdfBytes, conversionLog } = await convertDocxToPdf(file, inputPath, inputDir, detection.extension);
  return {
    originalName: file.name,
    inputType: "docx",
    sourceBuffer,
    pdfPath,
    pdfBytes,
    conversionLog,
  };
}

async function convertDocxToPdf(
  file: UploadedGradeFile,
  inputPath: string,
  outputDir: string,
  detectedExtension: string,
): Promise<{ pdfPath: string; pdfBytes: Buffer; conversionLog: ConversionLog }> {
  await mkdir(outputDir, { recursive: true });
  const libreOfficePath = await resolveLibreOfficeBinary();
  const expectedOutputPdfPath = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}.pdf`);
  const baseLog = await buildConversionLog({
    file,
    detectedExtension,
    inputPath,
    outputDir,
    libreOfficePath,
    command: libreOfficePath ? [libreOfficePath, "--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath] : [],
    stdout: "",
    stderr: "",
    exitCode: null,
    expectedOutputPdfPath,
  });

  if (!libreOfficePath) {
    logDocxConversionFailure(baseLog);
    throw new GradeApiError("LIBREOFFICE_NOT_FOUND", "LibreOffice not found. Install LibreOffice or set LIBREOFFICE_PATH.");
  }

  let stdout = "";
  let stderr = "";
  let exitCode: number | null = 0;

  try {
    const result = await execFileAsync(libreOfficePath, ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath], { timeout: 30000 });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    stdout = outputFromExecError(error, "stdout");
    stderr = outputFromExecError(error, "stderr");
    exitCode = codeFromExecError(error);
    const conversionLog = await buildConversionLog({
      file,
      detectedExtension,
      inputPath,
      outputDir,
      libreOfficePath,
      command: [libreOfficePath, "--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath],
      stdout,
      stderr,
      exitCode,
      expectedOutputPdfPath,
    });
    logDocxConversionFailure(conversionLog);
    throw new GradeApiError("DOCX_CONVERSION_FAILED", "DOCX could not be converted to PDF.", `LibreOffice exited with code ${exitCode ?? "unknown"}. Check server logs.`);
  }

  const files = await safeReaddir(outputDir);
  const pdfFiles = files.filter((fileName) => fileName.toLowerCase().endsWith(".pdf"));
  const expectedName = path.basename(expectedOutputPdfPath).toLowerCase();
  const selectedPdf = pdfFiles.find((fileName) => fileName.toLowerCase() === expectedName) ?? (pdfFiles.length === 1 ? pdfFiles[0] : null);
  const conversionLog = await buildConversionLog({
    file,
    detectedExtension,
    inputPath,
    outputDir,
    libreOfficePath,
    command: [libreOfficePath, "--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath],
    stdout,
    stderr,
    exitCode,
    expectedOutputPdfPath,
  });

  if (!selectedPdf) {
    logDocxConversionFailure(conversionLog);
    throw new GradeApiError("DOCX_CONVERSION_FAILED", "DOCX could not be converted to PDF.", "LibreOffice did not create a single usable PDF. Check server logs.");
  }

  const pdfPath = path.join(outputDir, selectedPdf);
  const pdfBytes = await readFile(pdfPath);
  return { pdfPath, pdfBytes, conversionLog };
}

export async function resolveLibreOfficeBinary(): Promise<string | null> {
  const candidates = [
    process.env.LIBREOFFICE_PATH,
    "soffice",
    "libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/soffice",
    "/opt/homebrew/bin/soffice",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 5000 });
      return candidate;
    } catch {
      // Try the next known install location.
    }
  }

  return null;
}

async function extractDocxModel(file: NormalizedUpload): Promise<DocumentModel> {
  const raw = await mammoth.extractRawText({ buffer: file.sourceBuffer });
  const html = await mammoth.convertToHtml({ buffer: file.sourceBuffer });
  const blocks = blocksFromHtml(html.value);
  const pdfBlocks = await blocksFromPdfBuffer(file.pdfBuffer);
  const fallbackBlocks = blocks.length ? blocks : blocksFromText(raw.value);
  const model = buildModel(file.name, "docx", pdfBlocks.length ? mergeStructureKinds(pdfBlocks, fallbackBlocks) : fallbackBlocks);
  return {
    ...model,
    renderingMode: "pdf",
    pdfDataUrl: file.pdfDataUrl,
    conversionNotice: file.conversionNotice,
  };
}

async function extractPdfModel(file: NormalizedUpload): Promise<DocumentModel> {
  const blocks = await blocksFromPdfBuffer(file.pdfBuffer);
  return buildModel(file.name, file.fileType, blocks);
}

async function blocksFromPdfBuffer(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return blocksFromText(result.text);
  } finally {
    await parser.destroy();
  }
}

function mergeStructureKinds(pdfBlocks: Array<{ text: string; kind: DocumentBlockKind }>, docxBlocks: Array<{ text: string; kind: DocumentBlockKind }>) {
  return pdfBlocks.map((block) => {
    const match = docxBlocks
      .map((candidate) => ({ candidate, similarity: textSimilarity(block.text, candidate.text) }))
      .sort((a, b) => b.similarity - a.similarity)[0];
    if (!match || match.similarity < 0.56) return block;
    return { ...block, kind: match.candidate.kind };
  });
}

function blocksFromHtml(html: string) {
  const blocks: Array<{ text: string; kind: DocumentBlockKind }> = [];
  const regex = /<(h[1-6]|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const tag = match[1].toLowerCase();
    const text = decodeHtml(stripTags(match[2])).trim();
    if (!text) continue;
    const kind: DocumentBlockKind = tag.startsWith("h") ? "heading" : tag === "li" ? "list" : tag === "table" ? "table" : classifyLine(text);
    blocks.push({ text, kind });
  }
  return blocks;
}

function blocksFromText(text: string) {
  const pageTexts = text.includes("\f") ? text.split(/\f+/) : chunkLines(text.split(/\r?\n/), 28).map((lines) => lines.join("\n"));
  const blocks: Array<{ text: string; kind: DocumentBlockKind }> = [];
  for (const pageText of pageTexts) {
    const lines = pageText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const grouped = groupLines(lines);
    for (const block of grouped) {
      blocks.push({ text: block, kind: classifyLine(block) });
    }
  }
  return blocks;
}

function buildModel(name: string, fileType: "pdf" | "docx", rawBlocks: Array<{ text: string; kind: DocumentBlockKind }>): DocumentModel {
  const hasExtractableText = rawBlocks.some((block) => meaningfulWords(block.text).length > 0);
  const blocks = rawBlocks.length ? rawBlocks : [{ text: "No extractable text found.", kind: "image" as const }];
  const pages = chunkBlocks(blocks, 18).map((pageBlocks, pageIndex) => ({
    pageNumber: pageIndex + 1,
    width: 612,
    height: 792,
    blocks: pageBlocks.map((block, index) => {
      const order = pageIndex * 18 + index;
      return {
        id: `${fileType}-${order}`,
        pageNumber: pageIndex + 1,
        order,
        kind: block.kind,
        text: collapseWhitespace(block.text),
        issueIds: [],
        bounds: boundsForBlock(pageIndex + 1, index, block.kind, block.text),
      };
    }),
  }));
  const text = hasExtractableText ? pages.flatMap((page) => page.blocks).map((block) => block.text).join("\n") : "";
  const normalizedText = normalizeText(text);
  const model: DocumentModel = {
    fileName: name,
    fileType,
    renderingMode: "pdf",
    pages,
    text,
    normalizedText,
    words: normalizedText ? normalizedText.split(" ") : [],
    hasExtractableText,
    structureEvidenceSource: fileType === "docx" ? "docx-structure" : "pdf-text",
    objectInventory: [] as DocumentObject[],
  };
  model.objectInventory = detectDocumentObjects(model);
  return model;
}

function attachIssues(model: DocumentModel, issues: ConcreteIssue[], side: "original" | "recreated"): DocumentPreview {
  const issueMap = new Map<string, string[]>();
  for (const issue of issues) {
    const ids = side === "original" ? issue.originalBlockIds : issue.recreatedBlockIds;
    for (const blockId of ids) {
      const current = issueMap.get(blockId) ?? [];
      current.push(issue.id);
      issueMap.set(blockId, current);
    }
  }

  return {
    fileName: model.fileName,
    fileType: model.fileType,
    renderingMode: model.renderingMode,
    pdfDataUrl: model.pdfDataUrl,
    conversionNotice: model.conversionNotice,
    pages: model.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => ({ ...block, issueIds: issueMap.get(block.id) ?? [] })),
    })),
  };
}

function makeIssue({
  type,
  title,
  original,
  recreated,
  severity,
  explanation,
  fix,
  category,
  pointsLost,
  confidence = severity === "high" ? "high" : severity,
  impact = severity,
  evidenceSource = "pdf-text",
}: {
  type: IssueType;
  title: string;
  original: DocumentBlock | null;
  recreated: DocumentBlock | null;
  severity: "high" | "medium" | "low";
  explanation: string;
  fix: string;
  category: string;
  pointsLost: number;
  confidence?: IssueConfidence;
  impact?: IssueImpact;
  evidenceSource?: EvidenceSource;
}): ConcreteIssue {
  const pageNumber = original?.pageNumber ?? recreated?.pageNumber ?? 1;
  return {
    id: "issue-pending",
    severity,
    confidence,
    impact,
    evidenceSource,
    type,
    title,
    location: `Page ${pageNumber}, ${locationForBlock(original ?? recreated)}`,
    originalExcerpt: original?.text ?? "Not found",
    recreatedExcerpt: recreated?.text ?? "Not found",
    explanation,
    fix,
    pageNumber,
    originalBlockIds: original ? [original.id] : [],
    recreatedBlockIds: recreated ? [recreated.id] : [],
    annotation: {
      label: title,
      fixLabel: shortFixLabel(type, original ?? recreated),
      tone: annotationTone(type),
      original: original?.bounds ?? placeholderRegion(recreated?.bounds, pageNumber),
      recreated: recreated?.bounds ?? placeholderRegion(original?.bounds, pageNumber),
    },
    scoreImpact: { category, pointsLost },
  };
}

function makeLayoutIssue(
  title: string,
  explanation: string,
  fix: string,
  pointsLost: number,
  type: IssueType = "layout-mismatch",
  severity: "high" | "medium" | "low" = "medium",
  category = "Visual polish",
  confidence: IssueConfidence = severity === "high" ? "high" : severity,
  impact: IssueImpact = severity,
  evidenceSource: EvidenceSource = "pdf-visual",
): ConcreteIssue {
  return {
    id: "issue-pending",
    severity,
    confidence,
    impact,
    evidenceSource,
    type,
    title,
    location: "Whole document",
    originalExcerpt: "Layout metric differs from recreated file.",
    recreatedExcerpt: "See side-by-side preview.",
    explanation,
    fix,
    pageNumber: 1,
    originalBlockIds: [],
    recreatedBlockIds: [],
    annotation: {
      label: title,
      fixLabel: shortFixLabel(type),
      tone: annotationTone(type),
      original: documentRegion(1),
      recreated: documentRegion(1),
    },
    scoreImpact: { category, pointsLost },
  };
}

function addCountIssue(
  issues: ConcreteIssue[],
  counts: readonly [number, number],
  type: IssueType,
  title: string,
  category: string,
  fix: string,
  confidence: IssueConfidence = "medium",
  impact: IssueImpact = "medium",
  evidenceSource: EvidenceSource = "pdf-visual",
) {
  if (counts[0] === counts[1]) return;
  const differenceRatio = Math.abs(counts[0] - counts[1]) / Math.max(counts[0], counts[1], 1);
  if (differenceRatio < 0.34) return;
  issues.push(makeLayoutIssue(title, `Source has ${counts[0]}; recreation has ${counts[1]}.`, fix, Math.min(4, Math.ceil(Math.abs(counts[0] - counts[1]) * 1.5)), type, "medium", category, confidence, impact, evidenceSource));
  const latest = issues[issues.length - 1];
  latest.scoreImpact.category = category;
}

function addPdfStructureCountIssues(issues: ConcreteIssue[], structure: ReturnType<typeof compareStructure>) {
  addCountIssue(
    issues,
    structure.headingCount,
    "heading-mismatch",
    "Heading structure check",
    "Organization and structure",
    "Visually verify that headings are styled correctly in the editable Google Doc.",
    "low",
    "medium",
    "pdf-text",
  );
  addCountIssue(
    issues,
    structure.listCount,
    "list-mismatch",
    "List structure check",
    "Organization and structure",
    "Visually verify that list items use native bullets or numbering in the editable Google Doc.",
    "low",
    "medium",
    "pdf-text",
  );
  if (structure.tableCount[0] === structure.tableCount[1]) return;
  const sourceHasTables = structure.tableCount[0] > 0;
  const recreatedHasTables = structure.tableCount[1] > 0;
  const title = !recreatedHasTables && sourceHasTables ? "Missing table-like section" : "Table structure uncertain";
  const explanation = recreatedHasTables
    ? "The table detector found different table-like regions, likely due to PDF extraction or page wrapping."
    : "A source table-like section was detected, but the recreated PDF did not expose a matching table-like region.";
  const fix = recreatedHasTables
    ? "Visually verify that the recreated section uses a native table with matching rows/columns."
    : "Check the recreated document for a missing table-like section or severe table layout mismatch.";
  issues.push(makeLayoutIssue(
    title,
    explanation,
    fix,
    recreatedHasTables ? 1 : 2,
    recreatedHasTables ? "table-structure-uncertain" : "table-visual-mismatch",
    "medium",
    "Organization and structure",
    recreatedHasTables ? "low" : "medium",
    recreatedHasTables ? "medium" : "high",
    "pdf-visual",
  ));
}

function hasNativeStructureEvidence(model: DocumentModel) {
  return model.structureEvidenceSource === "docx-structure" || model.structureEvidenceSource === "gdoc-structure";
}

function boundsForBlock(pageNumber: number, indexOnPage: number, kind: DocumentBlockKind, text: string): AnnotationRegion {
  const rowHeight = 0.045;
  const y = Math.min(0.88, 0.08 + indexOnPage * rowHeight);
  const width = kind === "heading" ? 0.66 : kind === "table" ? 0.82 : kind === "list" ? 0.72 : 0.78;
  const height = Math.min(0.16, Math.max(kind === "heading" ? 0.04 : 0.035, Math.ceil(text.length / 95) * 0.027));
  return {
    pageNumber,
    x: kind === "list" ? 0.13 : 0.1,
    y,
    width,
    height,
  };
}

function placeholderRegion(source: AnnotationRegion | undefined, pageNumber: number): AnnotationRegion | undefined {
  if (!source) return undefined;
  return {
    ...source,
    pageNumber,
    placeholder: true,
  };
}

function documentRegion(pageNumber: number): AnnotationRegion {
  return {
    pageNumber,
    x: 0.07,
    y: 0.07,
    width: 0.86,
    height: 0.82,
  };
}

function annotationTone(type: IssueType) {
  if (type === "missing-text" || type === "extra-text" || type === "text-changed") return "text" as const;
  if (type === "layout-mismatch" || type === "possible-image-text") return "layout" as const;
  return "structure" as const;
}

function shortFixLabel(type: IssueType, block?: DocumentBlock | null) {
  if (type === "missing-text") return block?.kind === "heading" ? "Apply Heading style" : "Add section";
  if (type === "extra-text") return "Check intent";
  if (type === "text-changed") return "Restore meaning";
  if (type === "wrong-order") return "Move block";
  if (type === "heading-mismatch") return "Apply Heading";
  if (type === "list-mismatch") return "Use native list";
  if (type === "table-visual-mismatch") return "Check table layout";
  if (type === "table-structure-uncertain") return "Verify rows/cells";
  if (type === "table-count-mismatch") return "Check table count";
  if (type === "table-layout-differs") return "Align table";
  if (type === "table-not-native") return "Rebuild as table";
  if (type === "object-mismatch") return "Recreate object";
  if (type === "possible-image-text") return "Check text";
  return "Check structure";
}

function noMajorIssue(): ConcreteIssue {
  return {
    id: "issue-1",
    severity: "low",
    confidence: "high",
    impact: "low",
    evidenceSource: "pdf-visual",
    type: "layout-mismatch",
    title: "No major block-level issue detected",
    location: "Whole document",
    originalExcerpt: "Automated block comparison found no major mismatch.",
    recreatedExcerpt: "Review visually before final submission.",
    explanation: "This automated grader found no major content, organization, or native-structure issue.",
    fix: "Do a final manual pass for readable spacing, native objects, and editable content.",
    pageNumber: 1,
    originalBlockIds: [],
    recreatedBlockIds: [],
    annotation: {
      label: "Final functional pass",
      fixLabel: "Review",
      tone: "layout",
      original: documentRegion(1),
      recreated: documentRegion(1),
    },
    scoreImpact: { category: "Visual polish", pointsLost: 0 },
  };
}

function bestMatch(block: DocumentBlock, candidates: DocumentBlock[]) {
  let best: { block: DocumentBlock; similarity: number } | null = null;
  for (const candidate of candidates) {
    const similarity = textSimilarity(block.text, candidate.text);
    if (!best || similarity > best.similarity) best = { block: candidate, similarity };
  }
  return best;
}

function textSimilarity(a: string, b: string) {
  const aWords = normalizeText(a).split(" ").filter(Boolean);
  const bWords = normalizeText(b).split(" ").filter(Boolean);
  if (!aWords.length || !bWords.length) return 0;
  const aSet = new Set(aWords);
  const bSet = new Set(bWords);
  const shared = Array.from(aSet).filter((word) => bSet.has(word)).length;
  const dice = (2 * shared) / (aSet.size + bSet.size);
  const lengthScore = ratioScore(a.length, b.length);
  return dice * 0.78 + lengthScore * 0.22;
}

function groupLines(lines: string[]) {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const kind = classifyLine(line);
    if (kind === "heading" || kind === "list" || kind === "table" || current.join(" ").length > 260) {
      if (current.length) blocks.push(current.join(" "));
      current = [line];
      if (kind !== "paragraph") {
        blocks.push(current.join(" "));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join(" "));
  return blocks;
}

function classifyLine(line: string): DocumentBlockKind {
  if (/^(\*|-|•|·|\d+[.)])\s+/.test(line)) return "list";
  if (/\t|\|/.test(line) || /\S+\s{3,}\S+/.test(line)) return "table";
  if (isHeadingLike(line)) return "heading";
  return "paragraph";
}

function structureIssueType(kind: DocumentBlockKind, pdfOnlyStructure = false): IssueType {
  if (kind === "heading") return "heading-mismatch";
  if (kind === "list") return "list-mismatch";
  if (kind === "table") return pdfOnlyStructure ? "table-structure-uncertain" : "table-not-native";
  return "layout-mismatch";
}

function structureIssueTitle(kind: DocumentBlockKind, pdfOnlyStructure = false) {
  if (kind === "heading") return pdfOnlyStructure ? "Heading structure check" : "Heading missing";
  if (kind === "list") return pdfOnlyStructure ? "List structure check" : "List not native";
  if (kind === "table") return pdfOnlyStructure ? "Table structure check" : "Table not native";
  return "Structure differs";
}

function fixForMissing(block: DocumentBlock) {
  if (block.kind === "heading") return "Add this as editable text using the Title or Heading style.";
  if (block.kind === "list") return "Add the missing lines with the Bulleted list or Numbered list button.";
  if (block.kind === "table") return "Insert a native Google Docs table and move the missing content into cells.";
  return "Add the missing source text as editable Google Docs text.";
}

function structureIssueExplanation(kind: DocumentBlockKind, pdfOnlyStructure = false) {
  if (!pdfOnlyStructure) {
    return `The source is a ${labelForKind(kind).toLowerCase()}, but the recreation does not appear to use that native structure.`;
  }
  if (kind === "table") return "Table structure appears different in PDF text extraction, but native table metadata cannot be verified from PDF.";
  if (kind === "list") return "List structure appears different in PDF text extraction, but native list metadata cannot be verified from PDF.";
  if (kind === "heading") return "Heading structure appears different in PDF text extraction, but native heading metadata cannot be verified from PDF.";
  return "Structure appears different in PDF extraction.";
}

function fixForStructure(kind: DocumentBlockKind, pdfOnlyStructure = false) {
  if (pdfOnlyStructure) {
    if (kind === "heading") return "Visually verify the heading and check the editable Google Doc style if needed.";
    if (kind === "list") return "Visually verify the list and check native bullets or numbering in the editable Google Doc if needed.";
    if (kind === "table") return "No action needed if the Google Doc uses a real native table and the visual rows/columns match.";
    return "Visually verify this structure in the recreated document.";
  }
  if (kind === "heading") return "Select the line and use the Styles dropdown to apply Title or a Heading style.";
  if (kind === "list") return "Select the lines and click Bulleted list or Numbered list.";
  if (kind === "table") return "Use Insert → Table and move the content into native table cells.";
  return "Use native paragraph text instead of a drawing, image, or mis-typed structure.";
}

function locationForBlock(block: DocumentBlock | null) {
  if (!block) return "unknown location";
  const indexOnPage = block.order % 18;
  if (indexOnPage < 4) return "near top";
  if (indexOnPage < 12) return "middle section";
  return "near bottom";
}

function labelForKind(kind: DocumentBlockKind) {
  if (kind === "list") return "List";
  if (kind === "table") return "Table";
  if (kind === "heading") return "Heading";
  if (kind === "image") return "Image";
  return "Paragraph";
}

function contentMeaningChanged(original: string, recreated: string) {
  const originalNumbers = original.match(/\b\d+(?:[.,:/-]\d+)*\b/g) ?? [];
  const recreatedNumbers = recreated.match(/\b\d+(?:[.,:/-]\d+)*\b/g) ?? [];
  if (originalNumbers.join("|") !== recreatedNumbers.join("|")) return true;

  const originalWords = normalizeText(original).split(" ").filter((word) => word.length > 3);
  const recreatedWords = new Set(normalizeText(recreated).split(" ").filter((word) => word.length > 3));
  if (!originalWords.length) return false;
  const retained = originalWords.filter((word) => recreatedWords.has(word)).length / originalWords.length;
  return retained < 0.62;
}

function shouldFlagMissingBlock(block: DocumentBlock, recreatedMeaningfulText: string, coverage: number) {
  const words = meaningfulWords(block.text);
  if (words.length < 4) return false;
  const blockPhrase = words.slice(0, Math.min(8, words.length)).join(" ");
  if (blockPhrase && recreatedMeaningfulText.includes(blockPhrase)) return false;
  if (coverage >= 92 && words.length < 12) return false;
  if (block.kind === "paragraph" && coverage >= 88) return false;
  return true;
}

function shouldFlagExtraBlock(block: DocumentBlock, original: DocumentModel) {
  const words = meaningfulWords(block.text);
  if (words.length < 8) return false;
  return textSimilarity(block.text, original.text) < 0.18;
}

function extractDocumentTitle(model: DocumentModel) {
  const blocks = allBlocks(model);
  const heading = blocks.find((block) => block.kind === "heading" && meaningfulWords(block.text).length >= 2);
  const candidate = heading ?? blocks.find((block) => meaningfulWords(block.text).length >= 3);
  return candidate ? collapseWhitespace(candidate.text).slice(0, 180) : "";
}

function sectionHeadings(model: DocumentModel) {
  return allBlocks(model)
    .filter((block) => block.kind === "heading" || numberedSectionLike(block.text))
    .map((block) => meaningfulWords(block.text).slice(0, 8).join(" "))
    .filter(Boolean)
    .slice(0, 20);
}

function numberedSectionLike(text: string) {
  return /^\s*\d+(?:\.\d+)*\s+[A-Z]/.test(text) || /^\s*[A-Z][A-Za-z0-9 ,:/-]{4,80}$/.test(text);
}

function topKeywords(text: string, limit: number) {
  const counts = new Map<string, number>();
  for (const word of identityWords(text)) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function identityWords(text: string) {
  const genericWords = new Set([
    "about", "above", "after", "again", "also", "answer", "application", "assessment", "below", "between", "candidate", "click", "coding", "complete", "correct", "document", "example", "file", "first", "follow", "form", "given", "hello", "include", "interest", "name", "need", "please", "question", "response", "section", "should", "start", "starter", "submit", "thank", "using", "version", "work",
  ]);
  return meaningfulWords(text)
    .filter((word) => word.length > 3)
    .filter((word) => !/^\d+$/.test(word))
    .filter((word) => !genericWords.has(word));
}

function overlapRatio(sourceItems: string[], recreatedItems: string[]) {
  const source = new Set(sourceItems);
  if (!source.size) return recreatedItems.length ? 0 : 1;
  const recreated = new Set(recreatedItems);
  const shared = Array.from(source).filter((item) => recreated.has(item)).length;
  return shared / source.size;
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function groupOrderIssues(issues: ConcreteIssue[]) {
  const first = issues[0];
  return {
    ...first,
    title: "Section order needs review",
    explanation: `${issues.length} nearby content blocks may be out of logical order.`,
    fix: first.annotation.tone === "structure" ? "Check the related section or table rows for logical ordering." : "Check the related section for logical ordering.",
    scoreImpact: { ...first.scoreImpact, pointsLost: Math.min(3, Math.ceil(issues.length / 3)) },
  };
}

function groupIssues(issues: ConcreteIssue[]) {
  const grouped = new Map<string, ConcreteIssue>();
  for (const issue of issues) {
    const key = `${issue.type}-${issue.pageNumber}-${issue.title}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, issue);
      continue;
    }
    grouped.set(key, {
      ...existing,
      explanation: existing.explanation === issue.explanation ? existing.explanation : `${existing.explanation} Similar nearby issues were grouped.`,
      scoreImpact: {
        ...existing.scoreImpact,
        pointsLost: Math.min(existing.scoreImpact.pointsLost + Math.ceil(issue.scoreImpact.pointsLost * 0.35), existing.scoreImpact.pointsLost + 2),
      },
    });
  }
  return Array.from(grouped.values()).sort((a, b) => issueSortScore(b) - issueSortScore(a));
}

function issueSortScore(issue: ConcreteIssue) {
  return severityRank(issue.impact) * 10 + severityRank(issue.confidence) * 4 + adjustedIssuePenalty(issue);
}

function generatePrioritizedFixes(issues: ConcreteIssue[], categoryScores: CategoryScore[]) {
  const fixes = issues
    .filter((issue) => issue.impact !== "low" && issue.confidence !== "low")
    .sort((a, b) => issueSortScore(b) - issueSortScore(a))
    .map((issue) => issue.fix);
  if (!fixes.length) fixes.push("Do a final manual pass for editable text, native objects, and readable spacing.");
  const weak = [...categoryScores].sort((a, b) => a.points / a.maxPoints - b.points / b.maxPoints)[0];
  if (weak?.name === "Native Google Docs functionality") fixes.push("Check headings, lists, tables, charts, and diagrams for native/editable recreation.");
  if (weak?.name === "Visual polish") fixes.push("Use the side-by-side preview for broad spacing, alignment, and readability only.");
  return Array.from(new Set(fixes)).slice(0, 6);
}

function severityRank(severity: "high" | "medium" | "low") {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function addDeduction(pointsLost: Map<string, number>, deductions: Map<string, string[]>, category: string, points: number, label: string) {
  pointsLost.set(category, (pointsLost.get(category) ?? 0) + points);
  const items = deductions.get(category) ?? [];
  items.push(`-${points} ${label}`);
  deductions.set(category, items);
}

function allBlocks(model: Pick<DocumentPreview, "pages">) {
  return model.pages.flatMap((page) => page.blocks);
}

function countKind(blocks: DocumentBlock[], kind: DocumentBlockKind) {
  return blocks.filter((block) => block.kind === kind).length;
}

function logicalTableCount(model: DocumentModel) {
  const tableBlocks = allBlocks(model)
    .filter((block) => block.kind === "table")
    .sort((a, b) => a.pageNumber - b.pageNumber || a.bounds.y - b.bounds.y);
  if (!tableBlocks.length) return 0;

  const zones: DocumentBlock[][] = [];
  for (const block of tableBlocks) {
    const previousZone = zones[zones.length - 1];
    const previousBlock = previousZone?.[previousZone.length - 1];
    if (previousBlock && tableBlocksAreAdjacent(previousBlock, block)) {
      previousZone.push(block);
    } else {
      zones.push([block]);
    }
  }
  return zones.length;
}

function tableBlocksAreAdjacent(previous: DocumentBlock, next: DocumentBlock) {
  const samePage = previous.pageNumber === next.pageNumber;
  const nextPage = next.pageNumber === previous.pageNumber + 1;
  const leftAligned = Math.abs(previous.bounds.x - next.bounds.x) < 0.08;
  const widthAligned = Math.abs(previous.bounds.width - next.bounds.width) < 0.12;
  const similarColumns = estimatedColumnCount(previous.text) === estimatedColumnCount(next.text);
  if (!leftAligned || !widthAligned) return false;
  if (samePage) {
    const previousBottom = previous.bounds.y + previous.bounds.height;
    const verticalGap = next.bounds.y - previousBottom;
    return verticalGap <= 0.08 && verticalGap >= -0.03;
  }
  return nextPage && previous.bounds.y > 0.72 && next.bounds.y < 0.22 && similarColumns;
}

function estimatedColumnCount(text: string) {
  if (text.includes("|")) return text.split("|").filter((value) => value.trim()).length;
  if (text.includes("\t")) return text.split("\t").filter((value) => value.trim()).length;
  const wideGaps = text.match(/\S+\s{3,}(?=\S)/g);
  return Math.max(1, (wideGaps?.length ?? 0) + 1);
}

function averageBlockLength(model: DocumentModel) {
  const blocks = allBlocks(model);
  if (!blocks.length) return 0;
  return blocks.reduce((sum, block) => sum + block.text.length, 0) / blocks.length;
}

function validateFile(file: UploadedGradeFile) {
  const extension = getExtension(file.name);
  const mimeType = file.type.toLowerCase();
  const hasAcceptedMime =
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/octet-stream" ||
    mimeType === "";

  if (!acceptedExtensions.has(extension) && !hasAcceptedMime) {
    throw new Error(`${file.name} must be a PDF or DOCX file.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} is larger than 15 MB.`);
  }
}

function getExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function detectFileType(file: UploadedGradeFile, buffer: Buffer): FileDetection {
  const extension = getExtension(file.name);
  const mimeType = file.type.toLowerCase();

  if (extension === "pdf" || mimeType === "application/pdf" || buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { extension: "pdf", inputType: "pdf" };
  }

  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    isZipBasedOfficeDocument(buffer)
  ) {
    return { extension: "docx", inputType: "docx" };
  }

  throw new Error(`${file.name} must be a PDF or DOCX file.`);
}

function isZipBasedOfficeDocument(buffer: Buffer) {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer.includes(Buffer.from("word/"));
}

function ensureExtension(name: string, extension: string) {
  const currentExtension = getExtension(name);
  if (currentExtension === extension) return name;
  const withoutExtension = currentExtension ? name.slice(0, -(currentExtension.length + 1)) : name;
  return `${withoutExtension || "upload"}.${extension}`;
}

function uniquePathPart(name: string) {
  const clean = sanitizeFileName(name || "upload").replace(/\.+$/g, "") || "upload";
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${clean}`;
}

async function buildConversionLog({
  file,
  detectedExtension,
  inputPath,
  outputDir,
  libreOfficePath,
  command,
  stdout,
  stderr,
  exitCode,
  expectedOutputPdfPath,
}: {
  file: UploadedGradeFile;
  detectedExtension: string;
  inputPath: string;
  outputDir: string;
  libreOfficePath: string | null;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  expectedOutputPdfPath: string;
}): Promise<ConversionLog> {
  const inputStat = await safeStat(inputPath);
  const expectedPdfStat = await safeStat(expectedOutputPdfPath);
  return {
    uploadedFilename: file.name,
    detectedMimeType: file.type,
    detectedExtension,
    tempInputPath: inputPath,
    tempOutputDir: outputDir,
    inputExists: Boolean(inputStat),
    inputSize: inputStat?.size ?? 0,
    libreOfficeBinaryPath: libreOfficePath,
    command,
    stdout,
    stderr,
    exitCode,
    filesCreatedInOutputDir: await safeReaddir(outputDir),
    expectedOutputPdfPath,
    expectedOutputPdfExists: Boolean(expectedPdfStat),
  };
}

async function safeStat(filePath: string) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

async function safeReaddir(directoryPath: string) {
  try {
    return await readdir(directoryPath);
  } catch {
    return [];
  }
}

function logDocxConversionFailure(log: ConversionLog) {
  console.error("[grader] DOCX conversion failed", log);
}

function outputFromExecError(error: unknown, key: "stdout" | "stderr") {
  if (typeof error === "object" && error && key in error) {
    const value = (error as Record<typeof key, unknown>)[key];
    return Buffer.isBuffer(value) ? value.toString("utf8") : typeof value === "string" ? value : "";
  }
  return "";
}

function codeFromExecError(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === "number" ? value : null;
  }
  return null;
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulText(text: string) {
  return meaningfulWords(text).join(" ");
}

function meaningfulWords(text: string) {
  const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "were", "you", "your", "not", "but", "have", "has", "had", "will", "can", "all", "any", "our", "their", "page"]);
  return normalizeText(text)
    .split(" ")
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .map(lightStem);
}

function phraseSet(words: string[], size: number) {
  const phrases = new Set<string>();
  if (words.length < size) {
    if (words.length) phrases.add(words.join(" "));
    return phrases;
  }
  for (let index = 0; index <= words.length - size; index += 1) {
    phrases.add(words.slice(index, index + size).join(" "));
  }
  return phrases;
}

function lightStem(word: string) {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function collapseWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sanitizeFileName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9 ._-]/g, "_").replace(/\s+/g, " ") || "upload";
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function chunkBlocks<T>(blocks: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < blocks.length; index += size) {
    chunks.push(blocks.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function ratioScore(a: number, b: number) {
  if (a === 0 && b === 0) return 1;
  if (a === 0 || b === 0) return 0;
  return Math.min(a, b) / Math.max(a, b);
}

function isHeadingLike(line: string) {
  if (line.length < 4 || line.length > 100) return false;
  if (/^(\*|-|•|·|\d+[.)])\s+/.test(line)) return false;
  const words = line.split(/\s+/);
  const titleCaseWords = words.filter((word) => /^[A-Z][a-z0-9]+/.test(word)).length;
  const mostlyCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
  return mostlyCaps || titleCaseWords / Math.max(words.length, 1) > 0.55;
}

function verdictForScore(score: number) {
  if (score >= 90) return "Excellent, likely acceptable";
  if (score >= 80) return "Good, likely acceptable with minor fixes";
  if (score >= 70) return "Borderline but possibly acceptable";
  if (score >= 60) return "Needs meaningful revision";
  return "Major functional or content issues";
}
