import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function resolveLibreOfficeBinary() {
  const candidates = [
    process.env.LIBREOFFICE_PATH,
    "soffice",
    "libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/soffice",
    "/opt/homebrew/bin/soffice",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 5000 });
      return candidate;
    } catch {
      // Continue searching known install locations.
    }
  }

  return null;
}

async function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
  if (!inputPath) {
    throw new Error('Usage: npm run debug:convert -- "/path/to/file.docx"');
  }

  const inputStat = await stat(inputPath);
  if (!inputStat.size) {
    throw new Error(`Input file is empty: ${inputPath}`);
  }

  const libreOfficePath = await resolveLibreOfficeBinary();
  if (!libreOfficePath) {
    throw new Error("LibreOffice not found. Install LibreOffice or set LIBREOFFICE_PATH.");
  }

  const outputDir = await mkdtemp(path.join(os.tmpdir(), "gdocs-grader-debug-"));
  await mkdir(outputDir, { recursive: true });

  const args = ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath];
  console.log("LibreOffice:", libreOfficePath);
  console.log("Command:", [libreOfficePath, ...args].join(" "));

  try {
    const { stdout, stderr } = await execFileAsync(libreOfficePath, args, { timeout: 30000 });
    const files = await readdir(outputDir);
    const pdfs = files.filter((file) => file.toLowerCase().endsWith(".pdf"));
    const expected = `${path.basename(inputPath, path.extname(inputPath))}.pdf`;
    const selected = pdfs.find((file) => file.toLowerCase() === expected.toLowerCase()) ?? (pdfs.length === 1 ? pdfs[0] : null);

    console.log("stdout:", stdout || "(empty)");
    console.log("stderr:", stderr || "(empty)");
    console.log("Output directory:", outputDir);
    console.log("Files:", files.length ? files.join(", ") : "(none)");

    if (!selected) {
      throw new Error("Conversion completed but no unambiguous PDF was produced.");
    }

    console.log("PDF:", path.join(outputDir, selected));
  } catch (error) {
    console.error("stdout:", error?.stdout || "(empty)");
    console.error("stderr:", error?.stderr || "(empty)");
    console.error("exit code:", typeof error?.code === "number" ? error.code : "(unknown)");
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
