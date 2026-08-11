/**
 * PDF Generator for Procesrente – oversigt
 *
 * Genererer en samlet oversigt over alle udfyldte renteberegninger:
 * én tabel med beløb, rentedato (Rente fra) og beregnet rente pr. linje
 * samt en sammentalt i alt-linje.
 */

import { formatAmount } from '../../layout/documentLayoutHelpers';
import type { DocumentComposer } from '../../model/documentModel';
import {
  buildStamdataBrevhovedData,
  defineDocument,
  type StandardDocumentMetadata,
} from '../documentGeneratorSetup';
import { buildSummedTotalRowSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import type { DocumentCommonOptions, DocumentStamdata } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { parseISODate, type ISODateString } from '../../../types/branded';
import { addCalculationPrinciples, addHypotheticalInterestWarning } from './renteDocument';
import type { DocumentGenerationSession } from '../../documentGenerationSession';
import type { DocumentArtifact } from '../../downloadArtifact';

const PDF_TITLE = 'Procesrente – oversigt';

/**
 * Én linje i oversigten, projiceret fra en gyldig renteberegning.
 */
export type RenteOversigtRow = Readonly<{
  beloeb: number;
  renterFra: ISODateString;
  beregnetRente: number;
}>;

type RenteOversigtDocumentOptions = DocumentCommonOptions & Readonly<{
  stamdata?: DocumentStamdata | null;
  kommentarer?: string;
  latestReferenceRatePeriodEnd?: ISODateString | null;
  metadata?: StandardDocumentMetadata;
}>;

const addDateLine = (writer: DocumentComposer, beregningsdato: ISODateString): void => {
  writer.writeWrappedText(`Rente beregnes til og med ${formatIsoDateLong(beregningsdato)}.`);
  writer.addSectionSpacer();
};

const addOversigtTable = (
  writer: DocumentComposer,
  rows: ReadonlyArray<RenteOversigtRow>,
  beregningsdato: ISODateString,
  latestReferenceRatePeriodEnd: ISODateString | null,
): void => {
  // Kolonner: fast Beløb (45 mm) | flex Rente fra | fast Beregnet rente (45 mm, højre).
  const columns: readonly ColumnSpec[] = [
    { width: { kind: 'fixed', mm: 45 }, align: 'left' },
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'fixed', mm: 45 }, align: 'right' },
  ];

  const dataRows: RowSpec[] = rows.map((row) => ({
    cells: [
      { text: `${formatAmount(row.beloeb)} kr.` },
      { text: formatIsoDateLong(row.renterFra) },
      { text: `${formatAmount(row.beregnetRente)} kr.` },
    ],
  }));

  const totalRow = buildSummedTotalRowSpec(
    'Samlet rentebeløb',
    rows.map((row) => row.beregnetRente),
    {
      columnCount: 3,
      valueColumnIndex: 2,
      formatValue: (total) => `${formatAmount(total)} kr.`,
      valueHasKrSuffix: true,
    }
  );

  const endDate = parseISODate(beregningsdato);
  const latestRatePeriodEnd = latestReferenceRatePeriodEnd ? parseISODate(latestReferenceRatePeriodEnd) : undefined;
  if (endDate && latestRatePeriodEnd) {
    addHypotheticalInterestWarning(writer, endDate, latestRatePeriodEnd);
  }

  writer.addTable({
    columns,
    hasHeaderRow: true,
    rows: [
      { kind: 'header', cells: [{ text: 'Beløb' }, { text: 'Rente fra' }, { text: 'Beregnet rente' }] },
      ...dataRows,
      ...(totalRow ? [totalRow] : []),
    ],
  });

};

/**
 * Skriver oversigts-indholdet til en eksisterende DocumentComposer.
 * Kalder ikke addFooter eller save — det er kalderens ansvar.
 */
export const writeRenteOversigtDocumentContent = (
  writer: DocumentComposer,
  beregningsdato: ISODateString,
  rows: ReadonlyArray<RenteOversigtRow>,
  options: RenteOversigtDocumentOptions = {}
): void => {
  if (rows.length === 0) {
    throw new Error('Ingen renteberegninger fundet for oversigt');
  }

  const { visBrevhoved = false, stamdata = null, kommentarer, latestReferenceRatePeriodEnd = null } = options;

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle(PDF_TITLE);
  addDateLine(writer, beregningsdato);
  addOversigtTable(writer, rows, beregningsdato, latestReferenceRatePeriodEnd);
  addCalculationPrinciples(writer, kommentarer);
};

/**
 * Generer og download oversigts-PDF for renteberegninger.
 *
 * @param beregningsdato - Datoen renter beregnes til og med (ISO).
 * @param rows - Projektion af de gyldige renteberegninger.
 * @param options - Valgfrie indstillinger (brevhoved/stamdata/kommentarer).
 */
type RenteOversigtDocumentInput = Readonly<{
  beregningsdato: ISODateString;
  rows: ReadonlyArray<RenteOversigtRow>;
  options: RenteOversigtDocumentOptions;
}>;

const generateRenteOversigt = defineDocument<RenteOversigtDocumentInput>({
  title: PDF_TITLE,
  filename: ({ options }, format) => resolveDocumentArtifactFileName(
    PDF_TITLE,
    false,
    options.stamdata?.journalnr,
    format
  ),
  metadata: ({ options }) => options.metadata,
  writeTitle: false,
  body: (writer, { beregningsdato, rows, options }) => {
    // Indholds-helperen ejer titel/brevhoved, fordi den testes og genbruges separat.
    writeRenteOversigtDocumentContent(writer, beregningsdato, rows, options);
  },
});

export const generateRenteOversigtDocument = (
  session: DocumentGenerationSession,
  beregningsdato: ISODateString,
  rows: ReadonlyArray<RenteOversigtRow>,
  options: RenteOversigtDocumentOptions = {}
): Promise<DocumentArtifact> => {
  return generateRenteOversigt(session, { beregningsdato, rows, options });
};
