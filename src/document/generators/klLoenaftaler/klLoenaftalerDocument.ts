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

import { buildStamdataBrevhovedData, initStandardDocumentWriter } from '../documentGeneratorSetup';
import { renderTableSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
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

  // To lige brede, centrerede kolonner. Justering defineres på kolonnerne (`align`),
  // så både PDF og Word læser samme kilde.
  const columns: readonly ColumnSpec[] = [
    { width: { kind: 'flex' }, align: 'center' },
    { width: { kind: 'flex' }, align: 'center' },
  ];

  const dataRows: RowSpec[] = klLoenaftalerRaekker.map((row) => ({
    cells: [{ text: row.fraDato }, { text: formatReguleringPct(row.reguleringPct) }],
  }));

  if (dataRows.length === 0) {
    dataRows.push({ cells: [{ text: 'Ingen lønaftaler tilgængelige.' }, { text: '' }] });
  }

  const startY = writer.getY();
  const { endY } = renderTableSpec(doc, startY, {
    columns,
    hasHeaderRow: true,
    rows: [{ kind: 'header', cells: [{ text: 'Dato' }, { text: 'Regulering' }] }, ...dataRows],
  });

  writer.setY(endY);

  writer.addFooter();
  writer.save(buildKlLoenaftalerDocumentFilename(stamdata?.journalnr));
};
