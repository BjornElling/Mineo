/**
 * PDF Generator for Arbejdsskadesatser
 *
 * Genererer PDF-dokument med årlige satser for arbejdsskadeområdet
 */

import { MARGINS, PDF_LINE_BOTTOM_SPACING_MM, SECTION_SPACER } from './pdfConfig';
import { formatCurrency, formatPercent } from '../formatUtils';
import { PDF_BASE_LINE_HEIGHT_MM, type BrevhovedData } from './pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from './pdfWriter';
import { TODAY } from '../../config/dateRanges';
import { formatCurrencyPerUnit, resolvePdfFileName } from './pdfFormatUtils';
import { getSatserForYear } from '../../data/lovbestemteRates';
import type { PdfCommonOptions } from './pdfOptions';

type SatserData = ReturnType<typeof getSatserForYear>;
type SatserPdfOptions = PdfCommonOptions;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return formatPercent(value);
};

export const buildSatserPdfFilename = (year: number): string => resolvePdfFileName(`Arbejdsskadesatser ${year}`, false);

const writeRows = (
  writer: PdfWriter,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): void => {
  for (const row of rows) {
    const [label = '', value = ''] = row;
    const rightLines = value.split('\n');
    const [firstLine = '', ...restLines] = rightLines;
    writer.writeLeftRightText(label, firstLine, { rightFontStyle: 'normal' });
    for (const line of restLines) {
      writer.advanceY(-PDF_LINE_BOTTOM_SPACING_MM);
      const lineStartX = writer.getPageWidth() - MARGINS.right - writer.getTextWidth(line);
      writer.writeWrappedTextContinued(line, writer.getTextWidth(line), lineStartX);
    }
    if (restLines.length > 0) writer.addSpacer(PDF_LINE_BOTTOM_SPACING_MM);
  }
};

/**
 * Generer og download PDF for arbejdsskadesatser
 *
 * @param {number} year - Året satserne gælder for
 * @param {Object} satser - Satser data fra getSatserForYear()
 * @param {SatserPdfOptions} options - Valgfrie indstillinger
 */
export const generateSatserPdf = (
  year: number,
  satser: SatserData,
  options: SatserPdfOptions = {}
): void => {
  const { visBrevhoved = false, stamdata = null } = options;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  // Dokumentets metadata
  writer.setProperties({
    title: `Arbejdsskadesatser ${year}`,
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Tilføj titel
  writer.writeTitle(`Arbejdsskadesatser ${year}`);

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

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Download PDF
  writer.save(buildSatserPdfFilename(year));
};


/**
 * Tilføj Erstatningsansvarsloven sektion
 */
const addEalSection = (
  writer: PdfWriter,
  eal: SatserData['eal'],
): void => {
  const rows: string[][] = [];

  // Godtgørelse for svie og smerte
  if (isPositiveFiniteNumber(eal.svieSmertePrDag)) {
    rows.push([
      'Godtgørelse for svie og smerte',
      formatCurrencyPerUnit(eal.svieSmertePrDag, 'sygedag'),
    ]);
  }

  // Maksimum for svie og smerte
  if (isPositiveFiniteNumber(eal.svieSmerteMax)) {
    rows.push(['Maksimum for svie og smerte', formatCurrency(eal.svieSmerteMax)]);
  }

  // Maksimum for erhvervsevnetabserstatning
  if (isPositiveFiniteNumber(eal.erhvervsevnetabEalMax)) {
    rows.push([
      'Maksimum for erhvervsevnetabserstatning',
      formatCurrency(eal.erhvervsevnetabEalMax),
    ]);
  }

  // Vejledende udtalelse
  if (isPositiveFiniteNumber(eal.vejledendeUdtalelseEet)) {
    rows.push([
      'Vejledende udtalelse om erhvervsevnetab',
      formatCurrency(eal.vejledendeUdtalelseEet),
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
  writer: PdfWriter,
  asl: SatserData['asl'],
): void => {
  const rows: string[][] = [];

  // Godtgørelse for varige mén
  if (isPositiveFiniteNumber(asl.varigeMenPrGrad)) {
    rows.push([
      'Godtgørelse for varige mén',
      formatCurrencyPerUnit(asl.varigeMenPrGrad, 'méngrad'),
    ]);
  }

  // Maksimum årsløn
  if (isPositiveFiniteNumber(asl.aarsloenAslMax)) {
    rows.push(['Maksimum årsløn', formatCurrency(asl.aarsloenAslMax)]);
  }

  // Minimum årsløn
  if (isPositiveFiniteNumber(asl.aarsloenMin)) {
    rows.push(['Minimum årsløn', formatCurrency(asl.aarsloenMin)]);
  }

  // Minimum årsløn (skader før 1.7.2024)
  if (isPositiveFiniteNumber(asl.aarsloenMinFoer2024)) {
    rows.push([
      'Minimum årsløn (skader før 1.7.2024)',
      formatCurrency(asl.aarsloenMinFoer2024),
    ]);
  }

  // Minimum årsløn (skader fra 1.7.2024)
  if (isPositiveFiniteNumber(asl.aarsloenMinFra2024)) {
    rows.push([
      'Minimum årsløn (skader fra 1.7.2024)',
      formatCurrency(asl.aarsloenMinFra2024),
    ]);
  }

  // Overgangsbeløb
  if (isPositiveFiniteNumber(asl.overgangsbelob)) {
    rows.push(['Overgangsbeløb', formatCurrency(asl.overgangsbelob)]);
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
  writer: PdfWriter,
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
      `${formatCurrency(enlig)} (enlig) / ${formatCurrency(samlevende)} (samlevende)\n` +
      `+ ${formatCurrency(barn)} per barn under 18 år`;
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
  writer: PdfWriter,
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
  writer: PdfWriter,
  rows: string[][],
  header: string,
): void => {
  writer.writeSubheader(header, PDF_BASE_LINE_HEIGHT_MM);
  writeRows(writer, rows);
  writer.addSpacer(SECTION_SPACER);
};
