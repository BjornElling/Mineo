/**
 * Dokument-generator for ménberegning
 *
 * Genererer dokumentation af ménberegning med fødselsdato, skadedato, méngrad og resultat.
 */

import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument, writeLabelValueRows } from '../documentGeneratorSetup';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import type { ISODateString } from '../../../types/branded';
import { type VarigeMenBeregningResult } from '../../../domain/varigemen/varigeMenCalculations';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { formatKr } from '../../../utils/formatUtils';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import type { SkadestypeDatoLabel } from '../../../domain/policies/stamdataCalculations';

/**
 * Tilføj stamdata-sektion
 */
const addStamdataSection = (
  writer: DocumentComposer,
  fodselsdato: ISODateString | undefined,
  skadedato: ISODateString | undefined,
  alderVedSkade: number,
  skadedatoLabel: SkadestypeDatoLabel
): void => {
  writer.writeBoldSubheader('Stamdata');
  writeLabelValueRows(writer, [
    { label: 'Fødselsdato', value: formatIsoDateLong(fodselsdato) },
    { label: skadedatoLabel, value: formatIsoDateLong(skadedato) },
    {
      label: skadedatoLabel === 'Anmeldelsesdato' ? 'Alder på anmeldelsestidspunkt' : 'Alder på skadestidspunkt',
      value: `${alderVedSkade} år`,
    },
  ]);
  writer.addSectionSpacer();
};

/**
 * Tilføj beregningsgrundlag-sektion
 */
const addBeregningsgrundlagSection = (
  writer: DocumentComposer,
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
      label: `Sats pr. méngrad i beregningsår ${beregningsResultat.beregningsaar}`,
      value: formatKr(beregningsResultat.satsPerMengrad),
    },
  ]);
  writer.addSectionSpacer();
};

/**
 * Tilføj beregnet méngodtgørelse-sektion
 */
const addResultatSection = (
  writer: DocumentComposer,
  mengrad: number,
  beregningsResultat: VarigeMenBeregningResult
): void => {
  writer.writeBoldSubheader('Beregnet méngodtgørelse');
  // Reduktionsbeløbet kommer fra beregningen (afstemt mod den oprundede slutgodtgørelse),
  // så grundbeløb − reduktion = godtgørelse går nøjagtigt op.
  writeLabelValueRows(writer, [
    {
      label: `Grundbeløb: ${mengrad} % mén á ${formatKr(beregningsResultat.satsPerMengrad)}`,
      value: formatKr(beregningsResultat.grundbeloebUdenReduktion),
    },
    {
      label: beregningsResultat.aldersreduktionPct === 0
        ? `Aldersreduktion, ${beregningsResultat.alderVedSkade} år = ${beregningsResultat.aldersreduktionPct} %`
        : `Aldersreduktion, ${beregningsResultat.alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`,
      value: beregningsResultat.aldersreduktionBeloeb === 0
        ? formatKr(beregningsResultat.aldersreduktionBeloeb)
        : `- ${formatKr(beregningsResultat.aldersreduktionBeloeb)}`,
    },
    {
      label: 'Beregnet méngodtgørelse',
      value: formatKr(beregningsResultat.beregnetGodtgoerelse),
      rightFontStyle: 'bold',
    },
  ]);
};

/**
 * Generer og download PDF for ménberegning
 */
type GenerateVarigeMenDocumentParams = DocumentCommonOptions & Readonly<{
  fodselsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  mengrad: number;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  /** Feltets navn i sagens kontekst – afgjort af `resolveSkadestypeDatoLabel`, ikke af generatoren. */
  skadedatoLabel: SkadestypeDatoLabel;
}>;

export const generateVarigeMenDocument = defineDocument<GenerateVarigeMenDocumentParams>({
  title: 'Ménberegning',
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    'Méngodtgørelse',
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, params) => {
    const {
      fodselsdato,
      skadedato,
      mengrad,
      beregningsdato,
      beregningsResultat,
      skadedatoLabel,
    } = params;
    addStamdataSection(writer, fodselsdato, skadedato, beregningsResultat.alderVedSkade, skadedatoLabel);
    addBeregningsgrundlagSection(writer, mengrad, beregningsdato, beregningsResultat);
    addResultatSection(writer, mengrad, beregningsResultat);
  },
});
