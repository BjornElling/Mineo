/**
 * Dokument-generator for KL-lønaftaler
 *
 * Genererer ét dokument med periode-reguleringssatserne fra de kommunale lønaftaler
 * fra 2005 og frem. To kolonner: Dato | Regulering (periode-procent, fx 1,40 %).
 *
 * Modsat KRL-dokumentet (fire satstabel-kolonner) er dette en enkelt serie. Der
 * vises bevidst ingen akkumuleret regulering — erstatningsberegningen kæder
 * periodesatserne på lønnen.
 *
 * SÆRLIG KL-LØNAFTALER-LOGIK — se docs/domain/taf/kl-loenaftaler-regulering.md.
 */

import type { RowInput } from 'jspdf-autotable';
import { PDF_CONTENT_WIDTH_MM } from '../../layout/pdfConfig';
import {
  resolveDocumentSectionEndY,
} from '../../layout/documentLayoutHelpers';
import { buildStamdataBrevhovedData, initStandardDocumentWriter } from '../documentGeneratorSetup';
import {
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  renderDocumentTable,
} from '../../layout/documentTableRenderer';
import { klLoenaftalerRaekker } from '../../../data/klLoenaftaler';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { DocumentCommonOptions } from '../../layout/documentOptions';

type KlLoenaftalerPdfParams = DocumentCommonOptions;

const KL_LOENAFTALER_DOCUMENT_TITLE = 'KL-lønaftaler';

export const buildKlLoenaftalerDocumentFilename = (journalnr?: string): string =>
  resolveDocumentArtifactFileName(KL_LOENAFTALER_DOCUMENT_TITLE, false, journalnr);

const formatReguleringPct = (value: number): string => `${formatAsAmount(value, 2)} %`;

export const generateKlLoenaftalerDocument = (params: KlLoenaftalerPdfParams): void => {
  const { visBrevhoved = false, stamdata = null } = params;

  const writer = initStandardDocumentWriter({ title: KL_LOENAFTALER_DOCUMENT_TITLE });
  const doc = writer.getDoc();

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle(KL_LOENAFTALER_DOCUMENT_TITLE);

  const headerRow: RowInput = [
    createDocumentTableHeaderCell('Dato', 'left'),
    createDocumentTableHeaderCell('Regulering', 'right'),
  ];

  const bodyRows: RowInput[] = klLoenaftalerRaekker.map((row) => [
    createDocumentTableCell(row.fraDato, { halign: 'left' }),
    createDocumentTableCell(formatReguleringPct(row.reguleringPct), { halign: 'right' }),
  ]);

  if (bodyRows.length === 0) {
    bodyRows.push([
      createDocumentTableCell('Ingen lønaftaler tilgængelige.', { halign: 'left' }),
      createDocumentTableCell('', { halign: 'right' }),
    ]);
  }

  // Kun to smalle kolonner: render en kompakt, venstrestillet tabel i stedet for at
  // strække den over hele sidebredden (ellers presses procenten helt ud til højre
  // kant med stor tom afstand til datoen).
  const datoWidth = 26;
  const reguleringWidth = 26;
  const tableWidth = Math.min(PDF_CONTENT_WIDTH_MM, datoWidth + reguleringWidth);
  const tableRows: RowInput[] = [headerRow, ...bodyRows];

  const finalY = renderDocumentTable({
    doc,
    startY: writer.getY(),
    body: tableRows,
    tableWidth,
    columnStyles: {
      0: { cellWidth: datoWidth, halign: 'left' },
      1: { cellWidth: reguleringWidth, halign: 'right' },
    },
  });

  writer.setY(resolveDocumentSectionEndY(finalY, writer.getY()));

  writer.addFooter();
  writer.save(buildKlLoenaftalerDocumentFilename(stamdata?.journalnr));
};
