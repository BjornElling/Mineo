/**
 * PDF Generator for Arbejdsskadesatser
 *
 * Genererer PDF-dokument med årlige satser for arbejdsskadeområdet
 */

import { formatPercent } from '../../../utils/formatUtils';
import type { DocumentWriter } from '../../writer';
import { buildStamdataBrevhovedData, defineDocument, writeLabelValueRows } from '../documentGeneratorSetup';
import { formatCurrencyPerUnit, formatKr, resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { getSatserForYear } from '../../../data/lovbestemteRates';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import type { DocumentGenerationSession } from '../../documentGenerationSession';
import type { DocumentArtifact } from '../../downloadArtifact';

type SatserData = ReturnType<typeof getSatserForYear>;
type SatserDocumentOptions = DocumentCommonOptions;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return formatPercent(value);
};

/**
 * Generer og download PDF for arbejdsskadesatser
 *
 * @param {number} year - Året satserne gælder for
 * @param {Object} satser - Satser data fra getSatserForYear()
 * @param {SatserDocumentOptions} options - Valgfrie indstillinger
 */
type SatserDocumentInput = Readonly<{
  year: number;
  satser: SatserData;
  options: SatserDocumentOptions;
}>;

const generateSatser = defineDocument<SatserDocumentInput>({
  title: ({ year }) => `Arbejdsskadesatser ${year}`,
  filename: ({ year }) => resolveDocumentArtifactFileName(
    `Arbejdsskadesatser ${year}`,
    false
  ),
  brevhoved: ({ options: { visBrevhoved = false, stamdata } }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, { satser }) => {

  // Tilføj Erstatningsansvarsloven sektion
  if (satser && satser.eal) {
    addEalSection(writer, satser.eal);
  }

  // Tilføj Arbejdsskadesikringsloven sektion
  if (satser && satser.asl) {
    addAslSection(writer, satser.asl);
  }

  // Tilføj Diverse sektion
  if (satser && satser.diverse) {
    addDiverseSection(writer, satser.diverse);
  }

  // Tilføj Referencer sektion
  if (satser && satser.referencer) {
    addReferenserSection(writer, satser.referencer);
  }

  },
});

export const generateSatserDocument = (
  session: DocumentGenerationSession,
  year: number,
  satser: SatserData,
  options: SatserDocumentOptions = {}
): Promise<DocumentArtifact> => {
  return generateSatser(session, { year, satser, options });
};


/**
 * Tilføj Erstatningsansvarsloven sektion
 */
const addEalSection = (
  writer: DocumentWriter,
  eal: SatserData['eal'],
): void => {
  const rows: string[][] = [];

  // Godtgørelse for svie og smerte
  if (isPositiveFiniteNumber(eal.svieSmertePrDag)) {
    rows.push([
      'Godtgørelse for svie og smerte',
      formatCurrencyPerUnit(eal.svieSmertePrDag, 'sygedag', 0),
    ]);
  }

  // Maksimum for svie og smerte
  if (isPositiveFiniteNumber(eal.svieSmerteMax)) {
    rows.push(['Maksimum for svie og smerte', formatKr(eal.svieSmerteMax, 0)]);
  }

  // Maksimum for erhvervsevnetabserstatning
  if (isPositiveFiniteNumber(eal.erhvervsevnetabEalMax)) {
    rows.push([
      'Maksimum for erhvervsevnetabserstatning',
      formatKr(eal.erhvervsevnetabEalMax, 0),
    ]);
  }

  // Mindstebeløb for forsørgertab
  if (isPositiveFiniteNumber(eal.foersoergertabEalMin)) {
    rows.push([
      'Mindstebeløb for forsørgertab',
      formatKr(eal.foersoergertabEalMin, 0),
    ]);
  }

  // Vejledende udtalelse
  if (isPositiveFiniteNumber(eal.vejledendeUdtalelseEet)) {
    rows.push([
      'Vejledende udtalelse om erhvervsevnetab',
      formatKr(eal.vejledendeUdtalelseEet, 0),
    ]);
  }

  if (rows.length > 0) {
    addRowsSection(writer, rows, 'Erstatningsansvarsloven');
  }
};

/**
 * Tilføj Arbejdsskadesikringsloven sektion
 */
const addAslSection = (
  writer: DocumentWriter,
  asl: SatserData['asl'],
): void => {
  const rows: string[][] = [];

  // Godtgørelse for varige mén
  if (isPositiveFiniteNumber(asl.varigeMenPrGrad)) {
    rows.push([
      'Godtgørelse for varige mén',
      formatCurrencyPerUnit(asl.varigeMenPrGrad, 'méngrad', 0),
    ]);
  }

  // Maksimum årsløn
  if (isPositiveFiniteNumber(asl.aarsloenAslMax)) {
    rows.push(['Maksimum årsløn', formatKr(asl.aarsloenAslMax, 0)]);
  }

  // Minimum årsløn
  if (isPositiveFiniteNumber(asl.aarsloenMin)) {
    rows.push(['Minimum årsløn', formatKr(asl.aarsloenMin, 0)]);
  }

  // Minimum årsløn (skader før 1.7.2024)
  if (isPositiveFiniteNumber(asl.aarsloenMinFoer2024)) {
    rows.push([
      'Minimum årsløn (skader før 1.7.2024)',
      formatKr(asl.aarsloenMinFoer2024, 0),
    ]);
  }

  // Minimum årsløn (skader fra 1.7.2024)
  if (isPositiveFiniteNumber(asl.aarsloenMinFra2024)) {
    rows.push([
      'Minimum årsløn (skader fra 1.7.2024)',
      formatKr(asl.aarsloenMinFra2024, 0),
    ]);
  }

  // Overgangsbeløb
  if (isPositiveFiniteNumber(asl.overgangsbelob)) {
    rows.push(['Overgangsbeløb', formatKr(asl.overgangsbelob, 0)]);
  }

  // Reguleringsprocent for erhvervsevnetab
  if (isPositiveFiniteNumber(asl.reguleringProcentErhvervsevnetab)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab',
      formatPercentage(asl.reguleringProcentErhvervsevnetab),
    ]);
  }

  // Reguleringsprocent for erhvervsevnetab (før 2024)
  if (isPositiveFiniteNumber(asl.reguleringProcentErhvervsevnetabFoer2024)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab (før 2024)',
      formatPercentage(asl.reguleringProcentErhvervsevnetabFoer2024),
    ]);
  }

  // Reguleringsprocent for erhvervsevnetab (fra 2024)
  if (isPositiveFiniteNumber(asl.reguleringProcentErhvervsevnetabFra2024)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab (fra 2024)',
      formatPercentage(asl.reguleringProcentErhvervsevnetabFra2024),
    ]);
  }

  if (rows.length > 0) {
    addRowsSection(writer, rows, 'Arbejdsskadesikringsloven');
  }
};

/**
 * Tilføj Diverse sektion
 */
const addDiverseSection = (
  writer: DocumentWriter,
  diverse: SatserData['diverse'],
): void => {
  const rows: string[][] = [];

  // Beløbsgrænse for fri proces
  const enlig = diverse.friProcesEnlig;
  const samlevende = diverse.friProcesSamlevende;
  const barn = diverse.friProcesBarn;

  if (
    isPositiveFiniteNumber(enlig) &&
    isPositiveFiniteNumber(samlevende) &&
    isPositiveFiniteNumber(barn)
  ) {
    const text =
      `${formatKr(enlig, 0)} (enlig) / ${formatKr(samlevende, 0)} (samlevende)\n` +
      `+ ${formatKr(barn, 0)} per barn under 18 år`;
    rows.push(['Beløbsgrænse for fri proces', text]);
  }

  // Reguleringssats
  if (isPositiveFiniteNumber(diverse.reguleringssats)) {
    rows.push(['Reguleringssats', formatPercentage(diverse.reguleringssats)]);
  }

  if (rows.length > 0) {
    addRowsSection(writer, rows, 'Diverse');
  }
};

/**
 * Tilføj Referencer sektion
 */
const addReferenserSection = (
  writer: DocumentWriter,
  referencer: SatserData['referencer'],
): void => {
  const rows: string[][] = [];

  const mapping = [
    { key: 'ealReference', label: 'Erstatningsansvarsloven' },
    { key: 'aslReference', label: 'Arbejdsskadesikringsloven' },
    { key: 'kapitalisering', label: 'Kapitalisering' },
    {
      key: 'kapitaliseringSkadeFra2011',
      label: 'Kapitalisering (skade fra 1.1.2011)',
    },
    {
      key: 'kapitaliseringSkadeFoer2011',
      label: 'Kapitalisering (skade før 1.1.2011)',
    },
    {
      key: 'kapitaliseringSkadeFra2007',
      label: 'Kapitalisering (skade fra 1.7.2007)',
    },
    {
      key: 'kapitaliseringSkadeFoer2007',
      label: 'Kapitalisering (skade før 1.7.2007)',
    },
    { key: 'friProcesReference', label: 'Fri proces' },
    { key: 'reguleringssatsReference', label: 'Reguleringssatser' },
  ];

  for (const m of mapping) {
    const value = referencer[m.key as keyof SatserData['referencer']];
    if (isNonEmptyString(value)) {
      rows.push([m.label, value.trim()]);
    }
  }

  if (rows.length > 0) {
    addRowsSection(writer, rows, 'Referencer');
  }
};

const addRowsSection = (
  writer: DocumentWriter,
  rows: string[][],
  header: string,
): void => {
  writer.writeBoldSubheader(header);
  // Satser holder rækker som [label, value]-par; map til den delte label/value-form.
  writeLabelValueRows(
    writer,
    rows.map(([label = '', value = '']) => ({ label, value })),
  );
  writer.addSectionSpacer();
};
