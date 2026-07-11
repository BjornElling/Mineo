/**
 * PDF Generator for Procesrenteberegning
 *
 * Genererer detaljeret specifikation af renteberegning med halvårlige perioder
 */

import {
  PDF_TABLE_NARROW_COLUMN_WIDTH,
} from '../../layout/pdfConfig';
import {
  formatAmount,
  formatPercent,
} from '../../layout/documentLayoutHelpers';
import type { DocumentWriter } from '../../writer';
import {
  buildStamdataBrevhovedData,
  defineDocument,
  type StandardDocumentMetadata,
} from '../documentGeneratorSetup';
import { buildSummedTotalRowSpec, renderTableSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { formatDanishDate, parseDanishDate } from '../../../utils/dateUtils';
import type { DocumentCommonOptions, DocumentStamdata } from '../../layout/documentOptions';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import { resolveDocumentArtifactFileName, sanitizeFilenamePart } from '../../layout/documentFormatUtils';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';
import type { DocumentGenerationSession } from '../../documentGenerationSession';
import type { DocumentArtifact } from '../../downloadArtifact';

/**
 * Stamdata til Rente PDF
 */
type RenteDocumentOptions = DocumentCommonOptions & Readonly<{
  stamdata?: DocumentStamdata | null;
  kommentarer?: string;
  latestReferenceRateDate?: string | null;
  metadata?: StandardDocumentMetadata;
}>;

const RIGHT_ALIGNED_INSET_RENTEDAGE_MM = 10;
const RIGHT_ALIGNED_INSET_RENTESATS_MM = 8;

export const addHypotheticalInterestWarning = (
  writer: DocumentWriter,
  endDate: Date,
  latestReferenceRateDate: Date | null,
): boolean => {
  if (latestReferenceRateDate === null || endDate <= latestReferenceRateDate) {
    return false;
  }

  writer.writeBoldWrappedText(
    `Der er kun fastsat procesrente frem til ${formatDanishDate(latestReferenceRateDate)}. Beregning derefter er hypotetisk!`
  );
  writer.addSectionSpacer();
  return true;
};

export const buildRenteDocumentBaseTitle = (amount: number, startDate: Date, endDate: Date): string => {
  return sanitizeFilenamePart(`Procesrente, ${formatAmount(amount)} kr. (${formatDanishDate(startDate)} - ${formatDanishDate(endDate)})`);
};

const addDescription = (
  writer: DocumentWriter,
  amount: number,
  startDate: Date,
  endDate: Date
): void => {
  const lines = [
    `Hovedstol: ${formatAmount(amount)} kr.`,
    `Periode: ${formatDanishDate(startDate)} - ${formatDanishDate(endDate)} (begge dage inkl.)`,
  ];

  for (const line of lines) {
    writer.writeWrappedText(line);
  }
  writer.addSectionSpacer();
};

const addSpecificationTable = (
  writer: DocumentWriter,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  endDate: Date,
  latestReferenceRateDate: Date | null
): void => {
  const doc = writer.getDoc();
  const startY = writer.getY();

  // Rentedage/Rentesats er højrejusteret i BEGGE kanaler (talkolonne-konvention, som
  // 'Beregnet rente'); PDF får desuden et fast visuelt inset. Overskrifterne holdes
  // centrerede via eksplicit celle-override på header-rækken.
  const columns: readonly ColumnSpec[] = [
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'fixed', mm: PDF_TABLE_NARROW_COLUMN_WIDTH }, align: 'right', rightInset: { kind: 'fixed', mm: RIGHT_ALIGNED_INSET_RENTEDAGE_MM } },
    { width: { kind: 'fixed', mm: PDF_TABLE_NARROW_COLUMN_WIDTH }, align: 'right', rightInset: { kind: 'fixed', mm: RIGHT_ALIGNED_INSET_RENTESATS_MM } },
    { width: { kind: 'fixed', mm: 35 }, align: 'right' },
  ];

  const dataRows: RowSpec[] = periods.map((period) => ({
    cells: [
      { text: `${formatDanishDate(period.startDate)} - ${formatDanishDate(period.endDate)}` },
      { text: `${period.days}` },
      { text: formatPercent(period.totalRatePct) },
      { text: `${formatAmount(period.interest)} kr.` },
    ],
  }));

  const totalRow = buildSummedTotalRowSpec(
    'Samlet rentebeløb',
    periods.map((period) => period.interest),
    {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${formatAmount(total)} kr.`,
      valueHasKrSuffix: true,
    }
  );

  let tableStartY = startY;
  if (addHypotheticalInterestWarning(writer, endDate, latestReferenceRateDate)) {
    tableStartY = writer.getY();
  }

  const { endY } = renderTableSpec(doc, tableStartY, {
    columns,
    hasHeaderRow: true,
    rows: [
      {
        kind: 'header',
        cells: [
          { text: 'Periode' },
          { text: 'Rentedage', align: 'center' },
          { text: 'Rentesats', align: 'center' },
          { text: 'Beregnet rente' },
        ],
      },
      ...dataRows,
      ...(totalRow ? [totalRow] : []),
    ],
  });

  writer.setY(endY);
};

/**
 * Skriver "Kommentarer" (hvis udfyldt) efterfulgt af "Beregningsprincipper".
 * Kanonisk for både per-række-specifikationer og oversigts-PDF'en, så de to
 * dokumenttyper deler præcis samme afsnit.
 */
export const addCalculationPrinciples = (
  writer: DocumentWriter,
  kommentarer: string | undefined
): void => {
  const normalizedKommentarer = typeof kommentarer === 'string' ? kommentarer.trim() : '';

  if (normalizedKommentarer !== '') {
    writer.writeBoldSubheaderWithWrappedText('Kommentarer', normalizedKommentarer);
  }

  writer.writeBoldSubheader('Beregningsprincipper');
  const principles = RENTE_CALCULATION_PRINCIPLES;

  for (const principle of principles) {
    writer.writeWrappedText(principle);
  }
};

/**
 * Skriver én rente-specifikation-sektion til en eksisterende DocumentWriter.
 * Kalder ikke addFooter eller save — det er kalderens ansvar.
 */
export const writeRenteDocumentContent = (
  writer: DocumentWriter,
  amount: number,
  startDate: Date,
  endDate: Date,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  options: RenteDocumentOptions
): void => {
  const {
    visBrevhoved = false,
    stamdata = null,
    kommentarer,
    latestReferenceRateDate = null,
  } = options;

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle('Procesrente');
  addDescription(writer, amount, startDate, endDate);
  addSpecificationTable(
    writer,
    periods,
    endDate,
    latestReferenceRateDate ? parseDanishDate(latestReferenceRateDate) : null
  );
  addCalculationPrinciples(writer, kommentarer);
};

/**
 * Generer og download PDF for procesrenteberegning
 *
 * @param {number} amount - Hovedstol
 * @param {string} interestStartDate - Rentens startdato (dd-mm-åååå)
 * @param {string} calculationDate - Beregningens slutdato (dd-mm-åååå)
 * @param {ReadonlyArray<ProcessInterestPeriod>} periods - Periode-output fra motoren
 * @param {RenteDocumentOptions} options - Valgfrie indstillinger
 */
export const generateRenteDocument = (
  session: DocumentGenerationSession,
  amount: number,
  interestStartDate: string,
  calculationDate: string,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  options: RenteDocumentOptions = {}
): Promise<DocumentArtifact> => {
  if (!periods || periods.length === 0) {
    throw new Error('Ingen perioder fundet for renteberegning');
  }

  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  if (!startDate || !endDate) {
    throw new Error('Ugyldige datoer for renteberegning');
  }

  return generateRente(session, { amount, startDate, endDate, periods, options });
};

type RenteDocumentInput = Readonly<{
  amount: number;
  startDate: Date;
  endDate: Date;
  periods: ReadonlyArray<ProcessInterestPeriod>;
  options: RenteDocumentOptions;
}>;

const generateRente = defineDocument<RenteDocumentInput>({
  title: 'Procesrente',
  filename: ({ amount, startDate, endDate, options }) =>
    resolveDocumentArtifactFileName(
      buildRenteDocumentBaseTitle(amount, startDate, endDate),
      false,
      options.stamdata?.journalnr
    ),
  metadata: ({ options }) => options.metadata,
  writeTitle: false,
  body: (writer, { amount, startDate, endDate, periods, options }) => {
    // Indholds-helperen ejer titel/brevhoved, fordi den også genbruges i samledokumenter.
    writeRenteDocumentContent(writer, amount, startDate, endDate, periods, options);
  },
});
