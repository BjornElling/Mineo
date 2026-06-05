import { AlignmentType, LineRuleType, type IStylesOptions } from 'docx';

/**
 * Centralt typografi-modul for Word-output (.docx).
 *
 * ENESTE sted hvor Word-dokumenternes udseende defineres. Generatoren
 * (`docxWriter.ts`) må IKKE sætte inline font/størrelse/spacing på de enkelte
 * afsnit og runs — den refererer udelukkende til de navngivne typografier herfra
 * via `DOCX_STYLE`. Det betyder:
 *
 *  1. Al tekst arver et navngivet Word-typografi (Normal, Overskrift osv.), så
 *     dokumentet kan redigeres centralt i Word og slå igennem overalt.
 *  2. Enhver fremtidig justering af udseendet sker HER (eller i Words egne
 *     typografi-definitioner) — bevidst, ét sted, aldrig spredt inline i koden.
 *
 * Enheder (OOXML-konvention):
 *  - `run.size`            : halve points (22 = 11 pt)
 *  - `run.font`            : skrifttype-navn
 *  - `paragraph.spacing.*` : tyvendedele af et point / dxa (120 = 6 pt)
 */

export const DOCX_FONT = 'Calibri';

/** Basis-skriftstørrelse i halve points (11 pt brødtekst). */
const BODY_SIZE = 22;
/** Mindste linjeafstand i dxa (14 pt). */
const MIN_LINE_SPACING_DXA = 280;
const MIN_LINE_SPACING = { line: MIN_LINE_SPACING_DXA, lineRule: LineRuleType.AT_LEAST } as const;

/**
 * Navngivne typografi-id'er. Generatoren refererer KUN til disse — aldrig til
 * rå font/størrelse/spacing-værdier.
 */
export const DOCX_STYLE = {
  /** Brødtekst — Words indbyggede "Normal". Alt andet er baseret på denne. */
  normal: 'Normal',
  /** Dokumenttitel (øverst). */
  title: 'Title',
  /** Sektionsoverskrift (Overskrift 1). */
  sectionHeader: 'Heading1',
  /** Fed PDF-underoverskrift — Word-typografien "Overskrift 2". */
  subheaderBold: 'Heading2',
  /** Understreget PDF-underoverskrift — Word-typografien "Overskrift 3". */
  subheaderUnderlined: 'Heading3',
  /** Datatabel — Words indbyggede "Table Paragraph". */
  tableCell: 'TableParagraph',
  /** Kantfri layout-tabel og tomme afstands-afsnit — Words indbyggede "No Spacing". */
  noSpacing: 'NoSpacing',
  /** Sidefod — Words indbyggede "Footer". */
  footer: 'Footer',
  /** Brevhoved — Words indbyggede "Header". */
  header: 'Header',
} as const;

export type DocxStyleId = (typeof DOCX_STYLE)[keyof typeof DOCX_STYLE];

/**
 * Bygger dokumentets typografi-definitioner. `default.document` sætter basisfont
 * og -størrelse, så ALT arver den, hvis intet andet angives. Hver navngiven
 * typografi er `basedOn: Normal` og overskriver kun det, der adskiller den.
 */
export const buildDocxStyles = (): IStylesOptions => ({
  default: {
    document: {
      run: { font: DOCX_FONT, size: BODY_SIZE },
      paragraph: { spacing: { after: 60, ...MIN_LINE_SPACING } },
    },
  },
  paragraphStyles: [
    {
      id: DOCX_STYLE.normal,
      name: 'Normal',
      quickFormat: true,
      run: { font: DOCX_FONT, size: BODY_SIZE },
      paragraph: { spacing: { after: 60, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.title,
      name: 'Title',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      run: { bold: true, size: 32 },
      paragraph: { spacing: { before: 480, after: 120, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.sectionHeader,
      name: 'Heading 1',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      run: { bold: true, size: 28 },
      // Outline-niveau 0 = Overskrift 1 (giver korrekt navigation/dispositionsvisning i Word).
      paragraph: { outlineLevel: 0, spacing: { before: 480, after: 240, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.subheaderBold,
      name: 'Heading 2',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      run: { font: DOCX_FONT, size: BODY_SIZE, bold: true },
      paragraph: { outlineLevel: 1, spacing: { before: 240, after: 120, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.subheaderUnderlined,
      name: 'Heading 3',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      run: { font: DOCX_FONT, size: BODY_SIZE, underline: {} },
      paragraph: { outlineLevel: 2, spacing: { before: 240, after: 120, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.tableCell,
      name: 'Table Paragraph',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.tableCell,
      run: { font: DOCX_FONT, size: 18 },
      paragraph: { spacing: { after: 0, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.noSpacing,
      name: 'No Spacing',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.noSpacing,
      run: { font: DOCX_FONT, size: BODY_SIZE },
      paragraph: { spacing: { after: 0, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.footer,
      name: 'Footer',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.footer,
      run: { font: DOCX_FONT, size: 16 },
      paragraph: { alignment: AlignmentType.RIGHT, spacing: { after: 0, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.header,
      name: 'Header',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.header,
      run: { font: DOCX_FONT, size: 20 },
      paragraph: { alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0, ...MIN_LINE_SPACING } },
    },
  ],
});
