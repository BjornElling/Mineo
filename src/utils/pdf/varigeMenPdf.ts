/**
 * PDF Generator for Ménberegning
 *
 * Genererer PDF-dokumentation af ménberegning med fødselsdato, skadesdato, méngrad og resultat
 */

import {
  PDF_BASE_LINE_HEIGHT_MM,
  type BrevhovedData,
} from './pdfHelpers';
import { SECTION_SPACER } from './pdfConfig';
import { createStandardPdfWriter, type PdfWriter } from './pdfWriter';
import { formatIsoDateLong } from '../dateFormatting';
import type { ISODateString } from '../../types/branded';
import type { VarigeMenBeregningResult } from '../../domain/varigemen/varigeMenCalculations';
import type { PdfCommonOptions } from './pdfOptions';
import { TODAY } from '../../config/dateRanges';
import { formatAsAmount } from '../formatUtils';
import { resolvePdfFileName } from './pdfFormatUtils';

const formatDateReadable = (isoDate: ISODateString | undefined): string => formatIsoDateLong(isoDate);
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
  skadesdato: ISODateString | undefined,
  alderVedSkade: number
): void => {
  writer.writeSubheader('Stamdata', PDF_BASE_LINE_HEIGHT_MM);
  writeRows(writer, [
    { label: 'Fødselsdato', value: formatDateReadable(fodselsdato) },
    { label: 'Skadesdato', value: formatDateReadable(skadesdato) },
    { label: 'Alder på skadestidspunkt', value: `${alderVedSkade} år` },
  ]);
  writer.addSpacer(SECTION_SPACER);
};

/**
 * Tilføj beregningsgrundlag-sektion
 */
const addBeregningsgrundlagSection = (
  writer: PdfWriter,
  mengrad: number | undefined,
  beregningsdato: ISODateString | undefined
): void => {
  writer.writeSubheader('Beregningsgrundlag', PDF_BASE_LINE_HEIGHT_MM);
  writeRows(writer, [
    { label: 'Méngrad', value: mengrad !== undefined ? `${mengrad} %` : '' },
    { label: 'Beregningsdato', value: formatDateReadable(beregningsdato) },
  ]);
  writer.addSpacer(SECTION_SPACER);
};

/**
 * Tilføj beregnet méngodtgørelse-sektion
 */
const addResultatSection = (
  writer: PdfWriter,
  mengrad: number | undefined,
  beregningsResultat: VarigeMenBeregningResult
): void => {
  writer.writeSubheader('Beregnet méngodtgørelse', PDF_BASE_LINE_HEIGHT_MM);
  const reduktionsBeloeb = beregningsResultat.grundbeloebUdenReduktion * beregningsResultat.aldersreduktionPct / 100;
  writeRows(writer, [
    {
      label: `Grundbeløb: ${mengrad} % mén á ${formatAsAmount(beregningsResultat.satsPerMengrad, 2)} kr.`,
      value: `${formatAsAmount(beregningsResultat.grundbeloebUdenReduktion, 2)} kr.`,
    },
    {
      label: `Aldersreduktion, ${beregningsResultat.alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`,
      value: `- ${formatAsAmount(reduktionsBeloeb, 2)} kr.`,
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
  skadesdato: ISODateString | undefined;
  mengrad: number | undefined;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
}>;

export const generateVarigeMenPdf = (params: GenerateVarigeMenPdfParams): void => {
  const {
    fodselsdato,
    skadesdato,
    mengrad,
    beregningsdato,
    beregningsResultat,
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
  addStamdataSection(writer, fodselsdato, skadesdato, beregningsResultat.alderVedSkade);

  // Tilføj beregningsgrundlag-sektion
  addBeregningsgrundlagSection(writer, mengrad, beregningsdato);

  // Tilføj resultat-sektion
  addResultatSection(writer, mengrad, beregningsResultat);

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Generer filnavn
  const filename = buildVarigeMenPdfFilename(stamdata?.journalnr);

  // Download PDF
  writer.save(filename);
};
