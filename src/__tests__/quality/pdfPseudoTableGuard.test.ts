/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '../../');
const VARIGE_MEN_PDF_PATH = path.resolve(SRC_ROOT, 'utils/pdf/varigeMenPdf.ts');
const SATSER_PDF_PATH = path.resolve(SRC_ROOT, 'utils/pdf/satserPdf.ts');
const AARSLOEN_PDF_PATH = path.resolve(SRC_ROOT, 'utils/pdf/aarsloenPdf.ts');

describe('PDF pseudo-table guard', () => {
  it('forbyder tabelrenderer i varige mén PDF for almindelige oplysningslinjer', () => {
    const source = fs.readFileSync(VARIGE_MEN_PDF_PATH, 'utf8');

    expect(source).not.toContain('renderEoStylePdfTable(');
  });

  it('forbyder tabelrenderer i satser PDF for almindelige oplysningslinjer', () => {
    const source = fs.readFileSync(SATSER_PDF_PATH, 'utf8');

    expect(source).not.toContain('renderEoStylePdfTable(');
  });

  it('forbyder headerløse pseudo-tabeller i årsløn PDF', () => {
    const source = fs.readFileSync(AARSLOEN_PDF_PATH, 'utf8');

    expect(source).not.toContain('hasHeaderRow: false');
  });
});
