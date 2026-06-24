/**
 * PDF Generator for Ménberegning
 *
 * Genererer PDF-dokumentation af ménberegning med fødselsdato, skadedato, méngrad og resultat
 */

import type { DocumentWriter } from '../../writer';
import { buildStamdataBrevhovedData, initStandardDocumentWriter, writeLabelValueRows } from '../documentGeneratorSetup';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import type { ISODateString } from '../../../types/branded';
import { type VarigeMenBeregningResult } from '../../../domain/varigemen/varigeMenCalculations';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { formatAsAmount } from '../../../utils/formatUtils';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';

export const buildVarigeMenDocumentFilename = (journalnr?: string): string => resolveDocumentArtifactFileName('Méngodtgørelse', false, journalnr);

/**
 * Tilføj stamdata-sektion
 */
const addStamdataSection = (
  writer: DocumentWriter,
  fodselsdato: ISODateString | undefined,
  skadedato: ISODateString | undefined,
  alderVedSkade: number,
  skadedatoLabel: 'Skadedato' | 'Anmeldelsesdato'
): void => {
  writer.writeBoldSubheader('Stamdata');
  writeLabelValueRows(writer, [
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
  writer: DocumentWriter,
  mengrad: number,
  beregningsdato: ISODateString | undefined,
  beregningsResultat: VarigeMenBeregningResult
): void => {
  // Satsen og året kommer fra den autoritative beregning (ikke en re-resolve i PDF-laget),
  // så den viste sats altid matcher den sats beregningen faktisk brugte.
  writer.writeBoldSubheader('Beregningsgrundlag');
  writeLabelValueRows(writer, [
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
  writer: DocumentWriter,
  mengrad: number,
  beregningsResultat: VarigeMenBeregningResult
): void => {
  writer.writeBoldSubheader('Beregnet méngodtgørelse');
  // Reduktionsbeløbet kommer fra beregningen (afstemt mod den oprundede slutgodtgørelse),
  // så grundbeløb − reduktion = godtgørelse går nøjagtigt op.
  writeLabelValueRows(writer, [
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
type GenerateVarigeMenPdfParams = DocumentCommonOptions & Readonly<{
  fodselsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  mengrad: number;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  /** Kanonisk: 'Skadedato' (uden s) eller 'Anmeldelsesdato' (med s) */
  skadedatoLabel: 'Skadedato' | 'Anmeldelsesdato';
}>;

export const generateVarigeMenDocument = (params: GenerateVarigeMenPdfParams): void => {
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

  const writer = initStandardDocumentWriter({ title: 'Ménberegning' });

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
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
  const filename = buildVarigeMenDocumentFilename(stamdata?.journalnr);

  // Download PDF
  writer.save(filename);
};
