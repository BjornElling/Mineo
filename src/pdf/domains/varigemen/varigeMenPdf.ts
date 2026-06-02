/**
 * PDF Generator for Ménberegning
 *
 * Genererer PDF-dokumentation af ménberegning med fødselsdato, skadedato, méngrad og resultat
 */

import type { BrevhovedData } from '../../shared/pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from '../../infrastructure/pdfWriter';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import type { ISODateString } from '../../../types/branded';
import { type VarigeMenBeregningResult } from '../../../domain/varigemen/varigeMenCalculations';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import { TODAY } from '../../../config/dateRanges';
import { formatAsAmount } from '../../../utils/formatUtils';
import { resolvePdfFileName } from '../../shared/pdfFormatUtils';

export const buildVarigeMenPdfFilename = (journalnr?: string): string => resolvePdfFileName('Méngodtgørelse', false, journalnr);

const writeRows = (
  writer: PdfWriter,
  rows: ReadonlyArray<
    Readonly<{
      label: string;
      value: string;
      rightFontStyle?: 'normal' | 'bold';
    }>
  >
): void => {
  for (const row of rows) {
    writer.writeLeftRightText(row.label, row.value, {
      rightFontStyle: row.rightFontStyle ?? 'normal',
    });
  }
};

/**
 * Tilføj stamdata-sektion
 */
const addStamdataSection = (
  writer: PdfWriter,
  fodselsdato: ISODateString | undefined,
  skadedato: ISODateString | undefined,
  alderVedSkade: number,
  skadedatoLabel: 'Skadedato' | 'Anmeldelsesdato'
): void => {
  writer.writeBoldSubheader('Stamdata');
  writeRows(writer, [
    { label: 'Fødselsdato', value: formatIsoDateLong(fodselsdato) },
    { label: skadedatoLabel, value: formatIsoDateLong(skadedato) },
    { label: 'Alder på skadestidspunkt', value: `${alderVedSkade} år` },
  ]);
  writer.addSectionSpacer();
};

/**
 * Tilføj beregningsgrundlag-sektion
 */
const addBeregningsgrundlagSection = (
  writer: PdfWriter,
  mengrad: number,
  beregningsdato: ISODateString | undefined,
  beregningsResultat: VarigeMenBeregningResult
): void => {
  // Satsen og året kommer fra den autoritative beregning (ikke en re-resolve i PDF-laget),
  // så den viste sats altid matcher den sats beregningen faktisk brugte.
  writer.writeBoldSubheader('Beregningsgrundlag');
  writeRows(writer, [
    { label: 'Méngrad', value: `${mengrad} %` },
    { label: 'Beregningsdato', value: formatIsoDateLong(beregningsdato) },
    {
      label: `Sats per méngrad i år ${beregningsResultat.beregningsaar}`,
      value: `${formatAsAmount(beregningsResultat.satsPerMengrad, 0)} kr.`,
    },
  ]);
  writer.addSectionSpacer();
};

/**
 * Tilføj beregnet méngodtgørelse-sektion
 */
const addResultatSection = (
  writer: PdfWriter,
  mengrad: number,
  beregningsResultat: VarigeMenBeregningResult
): void => {
  writer.writeBoldSubheader('Beregnet méngodtgørelse');
  // Reduktionsbeløbet kommer fra beregningen (afstemt mod den oprundede slutgodtgørelse),
  // så grundbeløb − reduktion = godtgørelse går nøjagtigt op.
  writeRows(writer, [
    {
      label: `Grundbeløb: ${mengrad} % mén á ${formatAsAmount(beregningsResultat.satsPerMengrad, 2)} kr.`,
      value: `${formatAsAmount(beregningsResultat.grundbeloebUdenReduktion, 2)} kr.`,
    },
    {
      label: `Aldersreduktion, ${beregningsResultat.alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`,
      value: `- ${formatAsAmount(beregningsResultat.aldersreduktionBeloeb, 2)} kr.`,
    },
    {
      label: 'Beregnet méngodtgørelse',
      value: `${formatAsAmount(beregningsResultat.beregnetGodtgoerelse)} kr.`,
      rightFontStyle: 'bold',
    },
  ]);
};

/**
 * Generer og download PDF for ménberegning
 */
type GenerateVarigeMenPdfParams = PdfCommonOptions & Readonly<{
  fodselsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  mengrad: number;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  /** Kanonisk: 'Skadedato' (uden s) eller 'Anmeldelsesdato' (med s) */
  skadedatoLabel: 'Skadedato' | 'Anmeldelsesdato';
}>;

export const generateVarigeMenPdf = (params: GenerateVarigeMenPdfParams): void => {
  const {
    fodselsdato,
    skadedato,
    mengrad,
    beregningsdato,
    beregningsResultat,
    skadedatoLabel,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  // Dokumentets metadata
  writer.setProperties({
    title: 'Ménberegning',
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
  writer.writeTitle('Ménberegning');

  // Tilføj stamdata-sektion
  addStamdataSection(writer, fodselsdato, skadedato, beregningsResultat.alderVedSkade, skadedatoLabel);

  // Tilføj beregningsgrundlag-sektion
  addBeregningsgrundlagSection(writer, mengrad, beregningsdato, beregningsResultat);

  // Tilføj resultat-sektion
  addResultatSection(writer, mengrad, beregningsResultat);

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Generer filnavn
  const filename = buildVarigeMenPdfFilename(stamdata?.journalnr);

  // Download PDF
  writer.save(filename);
};
