/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '../../');
const VARIGE_MEN_PDF_PATH = path.resolve(SRC_ROOT, 'document/generators/varigemen/varigeMenDocument.ts');
const SATSER_PDF_PATH = path.resolve(SRC_ROOT, 'document/generators/satser/satserDocument.ts');
const RENTE_PDF_PATH = path.resolve(SRC_ROOT, 'document/generators/renteberegning/renteDocument.ts');
const AARSLOEN_PDF_PATH = path.resolve(SRC_ROOT, 'document/generators/aarsloen/aarsloenDocument.ts');
const SH_DAGE_PDF_PATH = path.resolve(SRC_ROOT, 'document/generators/aarsloen/shDageDocument.ts');

describe('PDF pseudo-table guard', () => {
  it('forbyder tabelrenderer i varige mén PDF for almindelige oplysningslinjer', () => {
    const source = fs.readFileSync(VARIGE_MEN_PDF_PATH, 'utf8');

    expect(source).not.toContain('renderDocumentTable(');
  });

  it('forbyder SECTION_SPACER som generel sektionsafstand i writer-baseret varige mén PDF', () => {
    const source = fs.readFileSync(VARIGE_MEN_PDF_PATH, 'utf8');

    expect(source).not.toContain('writer.addSpacer(SECTION_SPACER)');
  });

  it('forbyder tabelrenderer i satser PDF for almindelige oplysningslinjer', () => {
    const source = fs.readFileSync(SATSER_PDF_PATH, 'utf8');

    expect(source).not.toContain('renderDocumentTable(');
  });

  it('forbyder lokal multiline-håndtering og SECTION_SPACER i writer-baseret satser PDF', () => {
    const source = fs.readFileSync(SATSER_PDF_PATH, 'utf8');

    expect(source).not.toContain("value.split('\\n')");
    expect(source).not.toContain('advanceY(-PDF_LINE_BOTTOM_SPACING_MM)');
    expect(source).not.toContain("writer.writeLeftRightText('',");
    expect(source).not.toContain('writer.addSpacer(SECTION_SPACER)');
  });

  it('forbyder lokal fontstyring og oppustet nextLineHeight i renteberegning PDF', () => {
    const source = fs.readFileSync(RENTE_PDF_PATH, 'utf8');

    expect(source).not.toContain("writer.setFont('helvetica', 'bold')");
    expect(source).not.toContain('writer.setFontSize(10)');
    expect(source).not.toContain("(3 * PDF_BASE_LINE_HEIGHT_MM) + SECTION_SPACER");
  });

  it('forbyder headerløse pseudo-tabeller i årsløn PDF', () => {
    const source = fs.readFileSync(AARSLOEN_PDF_PATH, 'utf8');

    expect(source).not.toContain('hasHeaderRow: false');
  });

  it('forbyder lokale writer-defaults, SECTION_SPACER og lokal tabelstart-helper i årsløn PDF', () => {
    const source = fs.readFileSync(AARSLOEN_PDF_PATH, 'utf8');

    expect(source).not.toContain("writer.writeBoldSubheader('Satser', PDF_BASE_LINE_HEIGHT_MM)");
    expect(source).not.toContain("writer.writeBoldSubheader('Beregningsprincipper', PDF_BASE_LINE_HEIGHT_MM)");
    expect(source).not.toContain("writer.writeBoldSubheader('Beregning', PDF_BASE_LINE_HEIGHT_MM)");
    expect(source).not.toContain('writer.addSpacer(SECTION_SPACER)');
    expect(source).not.toContain('headingY - PDF_SECTION_HEADING_GAP');
  });

  it('forbyder rå standardspacing og oppustet subheader-followup i SH-dage PDF', () => {
    const source = fs.readFileSync(SH_DAGE_PDF_PATH, 'utf8');

    expect(source).not.toContain('writer.addSpacer(PDF_BASE_LINE_HEIGHT_MM)');
    expect(source).not.toContain("(2 * PDF_BASE_LINE_HEIGHT_MM) + SECTION_SPACER");
    expect(source).not.toContain('writer.addSpacer(SECTION_SPACER)');
  });
});
