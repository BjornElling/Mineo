/**
 * DocumentWriter — fælles, format-agnostisk skrive-API for alt dokument-output
 *
 * Generatorer skriver mod denne grænseflade uden at vide, om output bliver PDF
 * (jsPDF) eller Word (.docx). To fabrikker opfylder den: PDF-kanalens
 * `createPdfWriter` (`src/pdf/`) og Word-kanalens `createDocxWriter` (`src/docx/`).
 * Den eksplicitte `DocumentGenerationSession` afgør hvilken der instantieres.
 *
 * Grænsefladen er semantisk: modelrendereren beder targetet om at rendere en tabel,
 * en underskrift eller et indholdsbredde-billede uden at kende kanalens dokumentobjekt,
 * cursor eller måleenhed. Kanaladapteren ejer hele oversættelsen til jsPDF eller OOXML.
 */

import type { BrevhovedData } from '../layout/documentLayoutHelpers';
import type { TableSpec } from '../layout/tableSpec';

export type DocumentProperties = Readonly<{
  title?: string;
  subject?: string;
  author?: string;
  keywords?: string;
  creator?: string;
}>;

export type DocumentWriter = {
  setProperties: (props: DocumentProperties) => void;
  keepWithNext: (minimumHeight: number) => void;
  addSpacer: (height: number) => void;
  addSectionSpacer: () => void;
  writeWrappedText: (text: string) => void;
  writeBoldWrappedText: (text: string) => void;
  writeWrappedTextContinued: (text: string) => void;
  writeNormalThenBoldLine: (normalPart: string, boldPart: string) => void;
  /**
   * Kanonisk valg til alle linjer med venstre/højre-kolonne.
   * Venstretekst wrapper altid til næste linje ved pladsmangel — ingen trunkering.
   */
  writeLeftRightText: (
    leftText: string,
    rightText: string,
    options?: Readonly<{
      leftFontStyle?: 'normal' | 'bold';
      rightFontStyle?: 'normal' | 'bold';
      separatorAboveValue?: Readonly<{
        widthMm: number;
        gapMm?: number;
      }>;
      minRightColumnWidth?: number;
      minRightColumnWidthText?: string;
    }>
  ) => void;
  writeSectionHeader: (text: string, nextLineHeight?: number) => void;
  writeTitle: (
    text: string,
    options?: Readonly<{
      trailingSpacing?: number;
    }>
  ) => void;
  writeBoldSubheader: (
    text: string,
    nextLineHeight?: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => void;
  writeBoldSubheaderIfContent: (params: Readonly<{
    text: string;
    nextLineHeight?: number;
    hasContent: boolean;
    renderContent: () => void;
    options?: Readonly<{ addTopSpacing?: boolean }>;
  }>) => boolean;
  writeBoldSubheaderWithWrappedText: (subheaderText: string, bodyText: string) => void;
  writeAtomicTableChunks: <T>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => void;
  writeUnderlinedSubheader: (text: string) => void;
  writeSignatureBlock: (dateLine: string, sigLine: string, skadelidteNavn: string) => void;
  writeBrevhoved: (brevhovedData: BrevhovedData) => void;
  addUdkastWatermark: () => void;
  addContentWidthImage: (
    dataUrl: string,
    options: Readonly<{
      aspectRatio: number;
      maxHeight: number;
      verticalPadding: number;
    }>
  ) => void;
  renderTable: (spec: TableSpec) => void;
  addPage: () => void;
  addFooter: () => void;
  build: () => Promise<Blob>;
};
