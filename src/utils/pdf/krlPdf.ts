/**
 * PDF Generator for KRL Satstabeller
 *
 * Genererer PDF-dokument med én samlet tabel over alle fire KRL satstabeller
 * (KTO kommuner, SHK kommuner, KTO regioner, SHK regioner)
 */

import jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { MARGINS } from './pdfConfig';
import {
  addSectionHeading,
  addTitle,
  applyNormalTextStyle,
  PDF_BASE_LINE_HEIGHT_MM,
  resolvePdfSectionEndY,
  type BrevhovedData,
} from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import {
  createPdfFixedColumnStyles,
  createPdfTableCell,
  createPdfTableHeaderCell,
  renderEoStylePdfTable,
} from './pdfTableRenderer';
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

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');
  const doc = writer.getDoc() as PdfDoc;

  writer.setProperties({
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
    writer.writeBrevhoved(brevhovedData);
    currentY = writer.getY();
  }

  currentY = addTitle(doc, 'KRL Satstabeller', currentY);

  // Byg samlet tabel
  const { rows } = buildCombinedRows();

  const headerRow: RowInput = [
    createPdfTableHeaderCell('Fra-dato', 'center'),
    ...krlSatstabeller.map((t) => createPdfTableHeaderCell(t.navn, 'center')),
  ];

  const bodyRows: RowInput[] = rows.map((row) =>
    row.map((cell) => ({
      content: cell,
      styles: { halign: 'center' as const },
    }))
  );

  if (bodyRows.length === 0) {
    bodyRows.push([
      createPdfTableCell('Ingen satser tilgængelige.', { halign: 'center' }),
      createPdfTableCell('', { halign: 'center' }),
      createPdfTableCell('', { halign: 'center' }),
      createPdfTableCell('', { halign: 'center' }),
      createPdfTableCell('', { halign: 'center' }),
    ]);
  }

  // Beregn lige kolonnebredder
  const pageWidth = doc.internal.pageSize.width;
  const tableWidth = pageWidth - MARGINS.left - MARGINS.right;
  const colWidth = tableWidth / 5;
  const tableRows: RowInput[] = [headerRow, ...bodyRows];

  const finalY = renderEoStylePdfTable({
    doc,
    startY: currentY,
    body: tableRows,
    tableWidth,
    columnStyles: createPdfFixedColumnStyles(5, colWidth, 'center'),
    didParseCell: (data) => {
      data.cell.styles.halign = 'center';
    },
  });

  const resolvedFinalY = resolvePdfSectionEndY(finalY, currentY, { spacer: 0 });

  // Kildetekst under tabellen
  const sourceY = addSectionHeading(doc, 'Kilde', resolvedFinalY + PDF_BASE_LINE_HEIGHT_MM);
  applyNormalTextStyle(doc);
  doc.text(
    'KRL\'s sats-tabeller kan genfindes på https://www.krl.dk/#/sats',
    MARGINS.left,
    sourceY,
    { maxWidth: pageWidth - MARGINS.left - MARGINS.right },
  );

  writer.addFooter();
  writer.save('KRL Satstabeller.pdf');
};
