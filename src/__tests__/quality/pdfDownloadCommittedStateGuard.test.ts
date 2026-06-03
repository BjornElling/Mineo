import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const PDF_DOWNLOAD_CALL_PATTERN = /\bdownload[A-Za-z]+Pdf\s*\(/;
// NOTE: Regex-guarden er et early-warning værn, ikke en fuld AST-analyse.
// Aliaserede imports/calls (fx usePersistedSection as useSection) kan omgå regexen.
const EO_SECTION_PERSISTED_PATTERNS = [
  /\busePersistedSection\s*\(\s*['"]erstatningsopgoerelse['"]\s*\)/,
  /\bgetPersistedData\s*\(\s*['"]erstatningsopgoerelse['"]\s*\)/,
];
const EO_PDF_DOWNLOAD_FILE_PATTERN = /\b(downloadErstatningsopgoerelsePdf|downloadTafFordeltPaaAarPdf|downloadTafOpreguleretPaaAarPdf)\s*\(/;
const EO_PDF_CRITICAL_PERSISTED_PATTERNS = [
  ...EO_SECTION_PERSISTED_PATTERNS,
  /\busePersistedSection\s*\(\s*['"]stamdata['"]\s*\)/,
  /\bgetPersistedData\s*\(\s*['"]stamdata['"]\s*\)/,
];

const collectFiles = (root: string): string[] => {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile() && SOURCE_FILE_PATTERN.test(absolutePath)) {
        files.push(absolutePath);
      }
    }
  }

  return files;
};

describe('pdfDownloadCommittedStateGuard', () => {
  it('forbyder persisted EO-reads i filer der trigger PDF-download', () => {
    const violatingFiles: string[] = [];
    const sourceFiles = collectFiles(SRC_ROOT);

    for (const absolutePath of sourceFiles) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (!PDF_DOWNLOAD_CALL_PATTERN.test(source)) continue;
      if (!EO_SECTION_PERSISTED_PATTERNS.some((pattern) => pattern.test(source))) continue;
      violatingFiles.push(path.relative(process.cwd(), absolutePath));
    }

    expect(violatingFiles).toEqual([]);
  });

  it('forbyder persisted stamdata/EO-reads i EO PDF-download filer', () => {
    const violatingFiles: string[] = [];
    const sourceFiles = collectFiles(SRC_ROOT);

    for (const absolutePath of sourceFiles) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (!EO_PDF_DOWNLOAD_FILE_PATTERN.test(source)) continue;
      if (!EO_PDF_CRITICAL_PERSISTED_PATTERNS.some((pattern) => pattern.test(source))) continue;
      violatingFiles.push(path.relative(process.cwd(), absolutePath));
    }

    expect(violatingFiles).toEqual([]);
  });
});
