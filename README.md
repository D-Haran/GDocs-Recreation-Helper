# GDocs Recreation Helper

A minimal Next.js app for DOCX → Google Docs recreation work. It helps a tasker quickly identify a source object, open a focused native Google Docs recreation guide, check concise rules, and grade a recreated export against the original source.

## Routes

- `/` — Recreation helper
- `/objects/[slug]` — Focused object guide
- `/rules` — Simple searchable rules
- `/grader` — Upload and grading tool
- `/api/grade` — Transient grading route handler

## What it does

- Searches and filters native object recreation guides.
- Shows short object guidance: when to use it, build target, menu path, steps, and important mistakes to avoid.
- Provides concise rules for common recreation decisions.
- Grades an original PDF/DOCX against a recreated PDF/DOCX using transient server-side PDF normalization, text extraction, and native-Google-Docs heuristics.

## What it does not do

- No authentication.
- No database.
- No analytics.
- No permanent file storage.
- No user tracking.
- No document contents are logged.

## Grader privacy behavior

Files are processed for grading only and are not stored. The grading API reads uploaded files from the request, converts DOCX uploads to temporary PDFs when LibreOffice headless is available, extracts text, computes scores, and returns the result. Temporary conversion files are deleted after processing. It does not save uploads to disk or a database.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Static TypeScript data files
- LibreOffice headless `soffice` for DOCX-to-PDF preview conversion when available
- `mammoth` for supplemental DOCX structure extraction
- `pdf-parse` for PDF text extraction

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Grading limitations

The grader prioritizes content completeness, document organization, native Google Docs functionality, object recreation quality, and broad visual polish. It does not grade for pixel-perfect recreation, and minor font, spacing, wrapping, punctuation, or page-break differences should not dominate the score.

DOCX uploads are normalized to PDF before visual preview. If LibreOffice headless is unavailable or conversion fails, upload/export the DOCX as PDF for best visual grading.
