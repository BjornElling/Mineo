/**
 * PDF Generator for KRL Satstabeller
 *
 * Genererer PDF-dokument med én samlet tabel over alle fire KRL satstabeller
 * (KTO kommuner, SHK kommuner, KTO regioner, SHK regioner)
 */

import jsPDF from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import { COLORS, MARGINS, FONT_SIZES, TABLE_STYLES } from './pdfConfig';
import { addTitle, addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import { TODAY } from '../../config/dateRanges';
import { krlSatstabeller } from '../../data/KRLrates';
import type { DanishDateString } from '../../types/branded';

export interface KRLStamdata {
  journalnr?: string;
  advokat?: string;
  sagsbehandler?: string;
}

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

type KRLPdfParams = Readonly<{
  visBrevhoved?: boolean;
  stamdata?: KRLStamdata | null;
}>;

const formatPct = (value: number | undefined): string => {
  if (value === undefined || value === 0) return '';
  return value.toLocaleString('da-DK', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' %';
};

/**
 * Bygger én samlet tabel med alle fire KRL satstabeller.
 *
 * Kolonne 0: Fra-dato
 * Kolonne 1-4: Reguleringsprocent for hver satstabel
 */
const buildCombinedRows = (): { dates: DanishDateString[]; rows: string[][] } => {
  // Saml alle unikke datoer fra alle fire tabeller
  const dateSet = new Set<DanishDateString>();
  for (const tabel of krlSatstabeller) {
    for (const v of tabel.vaerdier) {
      dateSet.add(v.fraDato);
    }
  }

  // Sortér datoer nyeste først (DD-MM-YYYY → sammenlignelig)
  const dates = Array.from(dateSet).sort((a, b) => {
    const [dA, mA, yA] = a.split('-').map(Number);
    const [dB, mB, yB] = b.split('-').map(Number);
    const numA = yA * 10000 + mA * 100 + dA;
    const numB = yB * 10000 + mB * 100 + dB;
    return numB - numA;
  });

  // Byg lookup pr. tabel: fraDato → reguleringsPct
  const lookups = krlSatstabeller.map((tabel) => {
    const map = new Map<DanishDateString, number>();
    for (const v of tabel.vaerdier) {
      map.set(v.fraDato, v.reguleringsPct);
    }
    return map;
  });

  const rows = dates.map((dato) => {
    const row: string[] = [dato];
    for (const lookup of lookups) {
      row.push(formatPct(lookup.get(dato)));
    }
    return row;
  });

  return { dates, rows };
};

export const generateKRLPdf = (params: KRLPdfParams): void => {
  const { visBrevhoved = false, stamdata = null } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as PdfDoc;
  doc.setDisplayMode('100%');

  doc.setProperties({
    title: 'KRL Satstabeller',
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    currentY = addBrevhoved(doc, brevhovedData);
  }

  currentY = addTitle(doc, 'KRL Satstabeller', currentY);

  // Byg samlet tabel
  const { rows } = buildCombinedRows();

  const headerRow: RowInput = [
    { content: 'Fra-dato', styles: { fontStyle: 'bold', halign: 'center' } },
    ...krlSatstabeller.map((t) => ({
      content: t.navn,
      styles: { fontStyle: 'bold' as const, halign: 'center' as const },
    })),
  ];

  const bodyRows: RowInput[] = rows.map((row) =>
    row.map((cell) => ({
      content: cell,
      styles: { halign: 'center' as const },
    }))
  );

  if (bodyRows.length === 0) {
    bodyRows.push([
      { content: 'Ingen satser tilgængelige.', styles: { halign: 'center' } },
      { content: '', styles: { halign: 'center' } },
      { content: '', styles: { halign: 'center' } },
      { content: '', styles: { halign: 'center' } },
      { content: '', styles: { halign: 'center' } },
    ]);
  }

  // Beregn lige kolonnebredder
  const pageWidth = doc.internal.pageSize.width;
  const tableWidth = pageWidth - MARGINS.left - MARGINS.right;
  const colWidth = tableWidth / 5;
  const tableRows: RowInput[] = [headerRow, ...bodyRows];
  const contentBottom = doc.internal.pageSize.getHeight() - MARGINS.bottom;
  const remainingHeight = contentBottom - currentY;
  const estimatedRowHeight = TABLE_STYLES.fontSize / 2.8 + TABLE_STYLES.cellPadding * 2;
  const minimumRows = Math.min(tableRows.length, 2);
  const minimumRequiredHeight = estimatedRowHeight * minimumRows;
  const shouldStartOnNewPage = remainingHeight < minimumRequiredHeight;
  const resolvedStartY = shouldStartOnNewPage ? MARGINS.top : currentY;

  if (shouldStartOnNewPage) {
    doc.addPage();
  }

  autoTable(doc, {
    startY: resolvedStartY,
    head: [],
    body: tableRows,
    margin: { left: MARGINS.left, right: MARGINS.right },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: TABLE_STYLES.cellPadding,
      textColor: COLORS.text,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: colWidth, halign: 'center' },
      1: { cellWidth: colWidth, halign: 'center' },
      2: { cellWidth: colWidth, halign: 'center' },
      3: { cellWidth: colWidth, halign: 'center' },
      4: { cellWidth: colWidth, halign: 'center' },
    },
    didParseCell: (data: CellHookData) => {
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
        data.cell.styles.overflow = 'ellipsize';
      } else if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;

  // Kildetekst under tabellen
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'KRL\'s sats-tabeller kan genfindes på https://www.krl.dk/#/sats',
    MARGINS.left,
    finalY + 8,
    { maxWidth: pageWidth - MARGINS.left - MARGINS.right },
  );

  addFooter(doc);
  doc.save('KRL Satstabeller.pdf');
};
