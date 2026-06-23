/**
 * Dokument-generator for KL-lønaftaler
 *
 * Genererer ét dokument med alle linjer i de kommunale lønaftaler fra 2005 og frem.
 * Tre kolonner: Dato | Tekst | Akkumuleret regulering (indeks-form, fx 1,124454).
 *
 * Modsat KRL-dokumentet (fire satstabel-kolonner) er dette en enkelt indeksserie,
 * og alle linjer vises — også ikke-regulerende datoer og delkomponenter på samme dato.
 */

import type { RowInput } from 'jspdf-autotable';
import { PDF_CONTENT_WIDTH_MM } from '../../layout/pdfConfig';
import {
  resolveDocumentSectionEndY,
  type BrevhovedData,
} from '../../layout/documentLayoutHelpers';
import { createStandardPdfWriter } from '../../writer';
import {
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  renderDocumentTable,
} from '../../layout/documentTableRenderer';
import { TODAY } from '../../../config/dateRanges';
import { klLoenaftaleRaekker } from '../../../data/klLoenaftaler';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { DocumentCommonOptions } from '../../layout/documentOptions';

type KLPdfParams = DocumentCommonOptions;

const KL_DOCUMENT_TITLE = 'KL-lønaftaler';

export const buildKLDocumentFilename = (journalnr?: string): string =>
  resolveDocumentArtifactFileName(KL_DOCUMENT_TITLE, false, journalnr);

const formatIndeks = (value: number): string => formatAsAmount(value, 6);

export const generateKLDocument = (params: KLPdfParams): void => {
  const { visBrevhoved = false, stamdata = null } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');
  const doc = writer.getDoc();

  writer.setProperties({
    title: KL_DOCUMENT_TITLE,
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

  writer.writeTitle(KL_DOCUMENT_TITLE);

  const headerRow: RowInput = [
    createDocumentTableHeaderCell('Dato', 'left'),
    createDocumentTableHeaderCell('Tekst', 'left'),
    createDocumentTableHeaderCell('Akkumuleret regulering', 'right'),
  ];

  const bodyRows: RowInput[] = klLoenaftaleRaekker.map((row) => [
    createDocumentTableCell(row.fraDato, { halign: 'left' }),
    createDocumentTableCell(row.tekst, { halign: 'left' }),
    createDocumentTableCell(formatIndeks(row.indeks), { halign: 'right' }),
  ]);

  if (bodyRows.length === 0) {
    bodyRows.push([
      createDocumentTableCell('Ingen lønaftaler tilgængelige.', { halign: 'left' }),
      createDocumentTableCell('', { halign: 'left' }),
      createDocumentTableCell('', { halign: 'right' }),
    ]);
  }

  const tableWidth = PDF_CONTENT_WIDTH_MM;
  const datoWidth = 24;
  const akkumuleretWidth = 40;
  const tekstWidth = tableWidth - datoWidth - akkumuleretWidth;
  const tableRows: RowInput[] = [headerRow, ...bodyRows];

  const finalY = renderDocumentTable({
    doc,
    startY: writer.getY(),
    body: tableRows,
    tableWidth,
    columnStyles: {
      0: { cellWidth: datoWidth, halign: 'left' },
      1: { cellWidth: tekstWidth, halign: 'left' },
      2: { cellWidth: akkumuleretWidth, halign: 'right' },
    },
  });

  writer.setY(resolveDocumentSectionEndY(finalY, writer.getY()));

  writer.addFooter();
  writer.save(buildKLDocumentFilename(stamdata?.journalnr));
};
