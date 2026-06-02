/**
 * PDF Generator for KRL Satstabeller
 *
 * Genererer PDF-dokument med én samlet tabel over alle fire KRL satstabeller
 * (KTO kommuner, SHK kommuner, KTO regioner, SHK regioner)
 */

import type { RowInput } from 'jspdf-autotable';
import { PDF_CONTENT_WIDTH_MM } from '../../infrastructure/pdfConfig';
import {
  resolvePdfSectionEndY,
  type BrevhovedData,
} from '../../shared/pdfHelpers';
import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import {
  createPdfFixedColumnStyles,
  createPdfTableCell,
  createPdfTableHeaderCell,
  renderPdfTable,
} from '../../shared/pdfTableRenderer';
import { TODAY } from '../../../config/dateRanges';
import { krlSatstabeller } from '../../../data/krlRates';
import { danishToISO, type DanishDateString } from '../../../types/branded';
import { resolvePdfFileName } from '../../shared/pdfFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { PdfCommonOptions } from '../../shared/pdfOptions';

type KRLPdfParams = PdfCommonOptions;

const formatPct = (value: number | undefined): string => {
  if (value === undefined || value === 0) return '';
  return formatAsAmount(value, 4) + ' %';
};

export const buildKRLPdfFilename = (journalnr?: string): string => resolvePdfFileName('KRL Satstabeller', false, journalnr);

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

  // Sortér datoer nyeste først. ISO-strenge (YYYY-MM-DD) sorterer kronologisk
  // ved ren strengsammenligning, så vi konverterer via den kanoniske danishToISO
  // i stedet for ad hoc-parsing. Uparselige datoer ('') sorteres sidst.
  const dates = Array.from(dateSet).sort((a, b) => {
    const isoA = danishToISO(a) ?? '';
    const isoB = danishToISO(b) ?? '';
    if (isoA === isoB) return 0;
    return isoA > isoB ? -1 : 1;
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
  const doc = writer.getDoc();

  writer.setProperties({
    title: 'KRL Satstabeller',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  writer.writeTitle('KRL Satstabeller');

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
  const tableWidth = PDF_CONTENT_WIDTH_MM;
  const colWidth = tableWidth / 5;
  const tableRows: RowInput[] = [headerRow, ...bodyRows];

  const finalY = renderPdfTable({
    doc,
    startY: writer.getY(),
    body: tableRows,
    tableWidth,
    columnStyles: createPdfFixedColumnStyles(5, colWidth, 'center'),
    didParseCell: (data) => {
      data.cell.styles.halign = 'center';
    },
  });

  writer.setY(resolvePdfSectionEndY(finalY, writer.getY()));

  // Kildetekst under tabellen
  writer.writeBoldSubheader('Kilde');
  writer.writeWrappedText('KRL\'s sats-tabeller kan genfindes på https://www.krl.dk/#/sats');

  writer.addFooter();
  writer.save(buildKRLPdfFilename(stamdata?.journalnr));
};
