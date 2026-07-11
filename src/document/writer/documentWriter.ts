/**
 * DocumentWriter — fælles, format-agnostisk skrive-API for alt dokument-output
 *
 * Generatorer skriver mod denne grænseflade uden at vide, om output bliver PDF
 * (jsPDF) eller Word (.docx). To fabrikker opfylder den: PDF-kanalens
 * `createPdfWriter` (`src/pdf/`) og Word-kanalens `createDocxWriter` (`src/docx/`).
 * Den eksplicitte `DocumentGenerationSession` afgør hvilken der instantieres.
 *
 * Den eneste kanal-bevidste detalje er `getDoc()`s honest union: på PDF-kanalen
 * den rå jsPDF-instans, på Word-kanalen `DocumentTableBridgeDocument`-broen. Kun den
 * fælles tabel-renderer forbruger den og forgrener selv via
 * `isDocumentTableBridgeDocument` (jf. `document/layout/documentTableBridge.ts`).
 * Det lukker den tidligere kanal-lækage (review-fund F2): et direkte jsPDF-only kald
 * på et bro-doc bliver en compile-fejl frem for en runtime-fejl på Word.
 */

import type jsPDF from 'jspdf';
import type { DocumentTableBridgeDocument } from '../layout/documentTableBridge';
import type { BrevhovedData } from '../layout/documentLayoutHelpers';

export type DocumentWriter = {
  setDisplayMode: (mode: string) => void;
  setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => void;
  setNormalTextStyle: () => void;
  getDoc: () => jsPDF | DocumentTableBridgeDocument;
  ensureSpace: (height: number) => void;
  getY: () => number;
  setY: (nextY: number) => void;
  addSpacer: (height: number) => void;
  addSectionSpacer: () => void;
  advanceY: (delta: number) => void;
  writeWrappedText: (text: string) => void;
  writeBoldWrappedText: (text: string) => void;
  writeWrappedTextContinued: (text: string, maxWidth?: number, x?: number) => void;
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
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
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
  writeUnderlinedSubheader: (text: string, x?: number) => void;
  writeSignatureBlock: (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => void;
  writeBrevhoved: (brevhovedData: BrevhovedData) => void;
  addUdkastWatermark: () => void;
  addImageDataUrl: (dataUrl: string, x: number, y: number, width: number, height: number) => void;
  getTextWidth: (text: string) => number;
  fitTextToWidth: (text: string, maxWidth: number) => string;
  getPageWidth: () => number;
  // Indholdsbredde i millimeter — enheds-entydig på tværs af PDF og Word (getPageWidth
  // returnerer mm for PDF men twips for Word, så den må ikke bruges til billed-sizing).
  getContentWidthMm: () => number;
  addPage: () => void;
  addFooter: () => void;
  build: () => Promise<Blob>;
};
