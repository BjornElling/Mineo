/**
 * PDF Generator for Ménberegning
 *
 * Genererer PDF-dokumentation af ménberegning med fødselsdato, skadesdato, méngrad og resultat
 */

import jsPDF from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import { COLORS, MARGINS, TABLE_STYLES, SECTION_SPACER } from './pdfConfig';
import { addTitle, addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import type { ISODateString } from '../../types/branded';
import type { StamdataValues } from '../../schemas/formSchemas';
import type { VarigeMenBeregningResult } from '../../domain/varigemen/varigeMenCalculations';

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator
 */
const formatDanishAmount = (amount: number, decimals: number = 0): string => {
  return amount.toLocaleString('da-DK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formaterer ISO-dato til læsbar dansk tekst (fx "1. januar 2025")
 */
const formatDateReadable = (isoDate: ISODateString | undefined): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';

  const [yyyy, mm, dd] = isoDate.split('-');
  const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));

  if (isNaN(dateObj.getTime())) return '';

  return `${dateObj.getDate()}. ${dateObj.toLocaleString('da-DK', {
    month: 'long',
  })} ${dateObj.getFullYear()}`;
};

/**
 * Tilføj stamdata-tabel
 */
const addStamdataTable = (
  doc: PdfDoc,
  fodselsdato: ISODateString | undefined,
  skadesdato: ISODateString | undefined,
  alderVedSkade: number,
  currentY: number
): number => {
  const tableData: RowInput[] = [];

  // Header-række med underoverskrift
  tableData.push([
    { content: 'Stamdata', colSpan: 2, styles: { fontStyle: 'bold', halign: 'left' } }
  ]);

  // Data-rækker
  tableData.push([
    { content: 'Fødselsdato', styles: { halign: 'left' } },
    { content: formatDateReadable(fodselsdato), styles: { halign: 'right' } }
  ]);

  tableData.push([
    { content: 'Skadesdato', styles: { halign: 'left' } },
    { content: formatDateReadable(skadesdato), styles: { halign: 'right' } }
  ]);

  tableData.push([
    { content: 'Alder på skadestidspunkt', styles: { halign: 'left' } },
    { content: `${alderVedSkade} år`, styles: { halign: 'right' } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
    didParseCell: (data: CellHookData) => {
      // Header-række (index 0) får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
      }
      // Alternerende rækker: lige rækker (2, 4, 6...) får lysegrå, ulige rækker (1, 3, 5...) får hvid
      else if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;
  return finalY + SECTION_SPACER;
};

/**
 * Tilføj beregningsgrundlag-tabel
 */
const addBeregningsgrundlagTable = (
  doc: PdfDoc,
  mengrad: number | undefined,
  beregningsdato: ISODateString | undefined,
  currentY: number
): number => {
  const tableData: RowInput[] = [];

  // Header-række med underoverskrift
  tableData.push([
    { content: 'Beregningsgrundlag', colSpan: 2, styles: { fontStyle: 'bold', halign: 'left' } }
  ]);

  // Méngrad
  tableData.push([
    { content: 'Méngrad', styles: { halign: 'left' } },
    { content: mengrad !== undefined ? `${mengrad} %` : '', styles: { halign: 'right' } }
  ]);

  // Beregningsdato
  tableData.push([
    { content: 'Beregningsdato', styles: { halign: 'left' } },
    { content: formatDateReadable(beregningsdato), styles: { halign: 'right' } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
    didParseCell: (data: CellHookData) => {
      // Header-række (index 0) får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
      }
      // Alternerende rækker: lige rækker (2, 4, 6...) får lysegrå, ulige rækker (1, 3, 5...) får hvid
      else if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;
  return finalY + SECTION_SPACER;
};

/**
 * Tilføj beregnet méngodtgørelse-tabel
 */
const addResultatTable = (
  doc: PdfDoc,
  mengrad: number | undefined,
  beregningsResultat: VarigeMenBeregningResult,
  currentY: number
): number => {
  const tableData: RowInput[] = [];

  // Header-række med underoverskrift
  tableData.push([
    { content: 'Beregnet méngodtgørelse', colSpan: 2, styles: { fontStyle: 'bold', halign: 'left' } }
  ]);

  // Grundbeløb
  tableData.push([
    { content: `Grundbeløb: ${mengrad} % mén á ${formatDanishAmount(beregningsResultat.satsPerMengrad, 2)} kr.`, styles: { halign: 'left' } },
    { content: `${formatDanishAmount(beregningsResultat.grundbeloebUdenReduktion, 2)} kr.`, styles: { halign: 'right' } }
  ]);

  // Aldersreduktion (kun hvis > 0)
  if (beregningsResultat.aldersreduktionPct > 0) {
    const reduktionsBeloeb = beregningsResultat.grundbeloebUdenReduktion * beregningsResultat.aldersreduktionPct / 100;
    tableData.push([
      { content: `Aldersreduktion, ${beregningsResultat.alderVedSkade} år = -${beregningsResultat.aldersreduktionPct} %`, styles: { halign: 'left' } },
      { content: `- ${formatDanishAmount(reduktionsBeloeb, 2)} kr.`, styles: { halign: 'right' } }
    ]);
  }

  // Slutresultat (tekst normal, værdi fed)
  tableData.push([
    { content: 'Beregnet méngodtgørelse', styles: { halign: 'left' } },
    { content: `${formatDanishAmount(beregningsResultat.beregnetGodtgoerelse)} kr.`, styles: { halign: 'right', fontStyle: 'bold' } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
    didParseCell: (data: CellHookData) => {
      // Header-række (index 0) får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
      }
      // Alternerende rækker: lige rækker (2, 4, 6...) får lysegrå, ulige rækker (1, 3, 5...) får hvid
      else if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;
  return finalY + SECTION_SPACER;
};

/**
 * Generer og download PDF for ménberegning
 */
type GenerateVarigeMenPdfParams = Readonly<{
  fodselsdato: ISODateString | undefined;
  skadesdato: ISODateString | undefined;
  mengrad: number | undefined;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  stamdata: StamdataValues | null;
  visBrevhoved?: boolean;
}>;

export const generateVarigeMenPdf = (params: GenerateVarigeMenPdfParams): void => {
  const {
    fodselsdato,
    skadesdato,
    mengrad,
    beregningsdato,
    beregningsResultat,
    stamdata,
    visBrevhoved = false,
  } = params;

  // Opret nyt PDF-dokument (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as PdfDoc;
  doc.setDisplayMode('100%');

  // Dokumentets metadata
  doc.setProperties({
    title: 'Ménberegning',
    subject: 'Ménberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved && stamdata) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata.journalnr,
      advokat: stamdata.advokat,
      sagsbehandler: stamdata.sagsbehandler,
    };
    currentY = addBrevhoved(doc, brevhovedData);
  }

  // Tilføj titel
  currentY = addTitle(doc, 'Ménberegning', currentY);

  // Tilføj stamdata-tabel
  currentY = addStamdataTable(doc, fodselsdato, skadesdato, beregningsResultat.alderVedSkade, currentY);

  // Tilføj beregningsgrundlag-tabel
  currentY = addBeregningsgrundlagTable(doc, mengrad, beregningsdato, currentY);

  // Tilføj resultat-tabel
  addResultatTable(doc, mengrad, beregningsResultat, currentY);

  // Tilføj footer med versionsnummer
  addFooter(doc);

  // Generer filnavn
  let filename = 'Ménberegning.pdf';
  if (stamdata) {
    const journalnr = stamdata.journalnr || '';
    const navn = stamdata.skadelidte || '';
    if (journalnr && navn) {
      filename = `${journalnr} - ${navn} - Ménberegning.pdf`;
    } else if (journalnr) {
      filename = `${journalnr} - Ménberegning.pdf`;
    } else if (navn) {
      filename = `${navn} - Ménberegning.pdf`;
    }
  }

  // Download PDF
  doc.save(filename);
};
