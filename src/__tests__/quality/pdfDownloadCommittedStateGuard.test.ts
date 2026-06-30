import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
// Dækker både de omdøbte Mineo-dokument-downloads (downloadXxxDokument) og de
// bevidst PDF-only standalone-funktioner (downloadStandaloneRentePdf m.fl.).
const PDF_DOWNLOAD_CALL_PATTERN = /\bdownload[A-Za-z]+(Pdf|Dokument)\s*\(/;
// NOTE: Regex-guarden er et early-warning værn, ikke en fuld AST-analyse.
// Aliaserede imports/calls (fx usePersistedSection as useSection) kan omgå regexen.
const EO_SECTION_PERSISTED_PATTERNS = [
  /\busePersistedSection\s*\(\s*['"]erstatningsopgoerelse['"]\s*\)/,
  /\bgetPersistedData\s*\(\s*['"]erstatningsopgoerelse['"]\s*\)/,
];
// Alle FIRE EO-snapshot-downloads fra Beregning-fanen skal dækkes — også graf-downloaden, der
// kaldes fra useEoBeregningViewModel (downloadTafKravGrafDokument). Udeladelse ville lade
// guarden overse persisted stamdata/EO-reads i graf-downloadens callsites.
const EO_PDF_DOWNLOAD_FILE_PATTERN = /\b(downloadErstatningsopgoerelseDokument|downloadTafFordeltPaaAarDokument|downloadTafOpreguleretPaaAarDokument|downloadTafKravGrafDokument)\s*\(/;
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

  // Vacuous-pass-værn: efter omdøbningen downloadXxxPdf → downloadXxxDokument må
  // guarden ikke stille holde op med at scanne noget. Beviser, at begge mønstre
  // faktisk matcher mindst én rigtig kildefil, så de tomme forventninger ovenfor
  // ikke passerer bare fordi regexerne er holdt op med at finde download-kald.
  it('matcher mindst én faktisk download-triggende fil (ikke-vacuous guard)', () => {
    const sourceFiles = collectFiles(SRC_ROOT);
    const callMatches = sourceFiles.filter((p) => PDF_DOWNLOAD_CALL_PATTERN.test(fs.readFileSync(p, 'utf8')));
    const eoMatches = sourceFiles.filter((p) => EO_PDF_DOWNLOAD_FILE_PATTERN.test(fs.readFileSync(p, 'utf8')));

    expect(callMatches.length).toBeGreaterThan(0);
    expect(eoMatches.length).toBeGreaterThan(0);
    // Regexerne skal kende det nye navneskema (Dokument), ikke kun det gamle (Pdf).
    expect(PDF_DOWNLOAD_CALL_PATTERN.test('downloadSatserDokument(')).toBe(true);
    // Alle fire EO-snapshot-downloads skal matche EO-mønstret (ingen udeladt).
    expect(EO_PDF_DOWNLOAD_FILE_PATTERN.test('downloadErstatningsopgoerelseDokument(')).toBe(true);
    expect(EO_PDF_DOWNLOAD_FILE_PATTERN.test('downloadTafFordeltPaaAarDokument(')).toBe(true);
    expect(EO_PDF_DOWNLOAD_FILE_PATTERN.test('downloadTafOpreguleretPaaAarDokument(')).toBe(true);
    expect(EO_PDF_DOWNLOAD_FILE_PATTERN.test('downloadTafKravGrafDokument(')).toBe(true);
  });
});
