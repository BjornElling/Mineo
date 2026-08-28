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
import { formatDeductionKr, formatDeductionPercent } from '../../../utils/deductionFormatting';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import type { StamdataDatoReference } from '../../../domain/policies/stamdataCalculations';

/**
 * Tilføj stamdata-sektion
 */
const addStamdataSection = (
  writer: DocumentComposer,
  fodselsdato: ISODateString | undefined,
  skadedato: ISODateString | undefined,
  alderVedSkade: number,
  datoReference: StamdataDatoReference
): void => {
  writer.writeBoldSubheader('Stamdata');
  writeLabelValueRows(writer, [
    { label: 'Fødselsdato', value: formatIsoDateLong(fodselsdato) },
    { label: datoReference.label, value: formatIsoDateLong(skadedato) },
    {
      // Tidspunktsformen kommer fra referencen (BB-121). Den blev før udledt ved at STRENGSAMMENLIGNE
      // på labelen – en afledning, der ville tie, hvis labelens ordlyd nogensinde ændrede sig.
      label: `Alder på ${datoReference.tidspunkt}`,
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
      // Samme delte fortegnsregel som skærmen (BB-129/130); de to stod før som hver sin ternary.
      label: `Aldersreduktion, ${beregningsResultat.alderVedSkade} år = ${formatDeductionPercent(
        beregningsResultat.aldersreduktionPct,
        `${beregningsResultat.aldersreduktionPct} %`
      )}`,
      value: formatDeductionKr(beregningsResultat.aldersreduktionBeloeb),
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
  /** Datoens navn OG dens afledte former i sagens kontekst – afgjort af kalderen, ikke af generatoren. */
  datoReference: StamdataDatoReference;
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
      datoReference,
    } = params;
    addStamdataSection(writer, fodselsdato, skadedato, beregningsResultat.alderVedSkade, datoReference);
    addBeregningsgrundlagSection(writer, mengrad, beregningsdato, beregningsResultat);
    addResultatSection(writer, mengrad, beregningsResultat);
  },
});
