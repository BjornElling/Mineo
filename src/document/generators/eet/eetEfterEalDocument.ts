/**
 * PDF Generator for EET efter EAL i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af EAL-kravsberegningen.
 * Al indhold er på én side (ingen tabeller i UI'en).
 */

import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import type { EetEalComputation } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { buildAldersreduktionEtiket } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import {
  ERHVERVSEVNETAB_EAL_PCT_LABEL,
  resolveErhvervsevnetabMaksimumTekst,
} from '../../../domain/erhvervsevnetab/eetMaksimumTekst';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { formatKr, resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import { formatDeductionKr, formatDeductionPercent } from '../../../utils/deductionFormatting';
import { formatPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { toKroner } from '../../../domain/money/money';
import { resolveStamdataDatoReference } from '../../../domain/policies/stamdataCalculations';
import { buildForligIndgaaetSaetning } from '../../../domain/erstatningsopgoerelse/engines/forligsgrad';
import { BEREGNET_EET_EFTER_EAL_LABEL } from '../../../domain/erhvervsevnetab/eetLabels';

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

type GenerateEfterEalDocumentParams = DocumentCommonOptions &
  Readonly<{
    computation: EetEalComputation;
  }>;

export type EfterEalBodyOptions = Readonly<{
  /** `false` i differencekravets bilag, som har sin egen beregningsdato-header på forsiden. */
  includeBeregningsdatoHeader?: boolean;
  /**
   * `true` i differencekravets bilag, når sagen HAR et forlig om ansvarsgrad.
   *
   * Bilaget viser bevidst det UREDUCEREDE EAL-krav, fordi det er differencekravets grundlag, og
   * forliget anvendes på differencekravets bundlinje efter alle fire ASL-fradrag. Uden linjen ville
   * læseren møde et EAL-krav uden forlig og en bundlinje med forlig og ikke kunne se sammenhængen.
   */
  forligIndregnesIDifferencekravet?: boolean;
}>;

export const FORLIG_INDREGNET_I_DIFFERENCEKRAVET_TEKST =
  'Forliget om ansvarsgrad er ikke indregnet i dette bilag – det anvendes på differencekravet på forsiden.';

export const renderEfterEalBody = (
  writer: DocumentComposer,
  computation: EetEalComputation,
  options: EfterEalBodyOptions = {}
): void => {
  const { includeBeregningsdatoHeader = true, forligIndregnesIDifferencekravet = false } = options;
  const rowOpts = { rightFontStyle: 'normal' as const };

  // Datoens navn følger skadestypen i alle afledte tekster (BB-121). Referencen udledes af beregningen –
  // IKKE af dokumentets `stamdata`, som kun projiceres, når brevhovedet er slået til og ellers er tom.
  // Begge kaldere (eget dokument og differencekrav-bilaget) får derfor samme navn med brevhovedet fra.
  const datoReference = resolveStamdataDatoReference(computation.skadestype);

  if (includeBeregningsdatoHeader) {
    writer.writeSectionHeader('Beregning');

    writer.writeLeftRightText(
      'Beregningsdato',
      formatIsoDateLong(computation.beregningsdato),
      rowOpts
    );
  }

  // ── Specifikation ──────────────────────────────────────────────────────────

  writer.writeSectionHeader('Specifikation');

  writer.writeBoldSubheader('Årsløn');

  // Sagens egen dato står i Specifikationen og ikke i den betingede «Beregning»-sektion (BB-182),
  // fordi differencekravet trykker netop denne krop som bilag med `includeBeregningsdatoHeader` =
  // false – lå datoen i headeren, ville bilaget mangle den forudsætning, både årslønnens
  // opregulering og aldersreduktionen hviler på. Navnet følger skadestypen (BB-121).
  //
  // Kort form `dd-mm-åååå` som Fødselsdato-rækken nedenfor: de to datoer er specifikationens eneste
  // to, de bærer tilsammen aldersreduktionen, og en modpart skal kunne lægge dem op mod hinanden
  // uden at oversætte mellem to formater (BB-146's formregel). «Beregningsdato» i headeren står i
  // lang form, fordi den er sagens overskrift og ikke et led i et regnestykke.
  writer.writeLeftRightText(
    datoReference.label,
    formatISOToDanish(computation.skadedato),
    rowOpts
  );

  writer.writeLeftRightText(
    `Årsløn på ${datoReference.tidspunktBestemt}`,
    formatKr(toKroner(computation.aarsloenOre)),
    rowOpts
  );

  if (computation.reguleringsaar.length > 0) {
    writer.writeLeftRightText(
      `Regulering fra ${datoReference.aar} ${computation.skadesaar} til beregningsår ${computation.beregningsaar}`,
      `+ ${formatPct(computation.reguleringsPctRounded4)}`,
      rowOpts
    );

    writer.writeLeftRightText(
      `${formatKr(toKroner(computation.aarsloenOre))} x (100 % + ${formatPct(computation.reguleringsPctRounded4)}) (afrundet) =`,
      formatKr(toKroner(computation.reguleretAarsloenOre)),
      rowOpts
    );
  }

  writer.writeBoldSubheader('Erhvervsevnetab');

  writer.writeLeftRightText(
    ERHVERVSEVNETAB_EAL_PCT_LABEL,
    formatPct(computation.eetPct),
    rowOpts
  );

  writer.writeLeftRightText(
    'Kapitaliseringsfaktor',
    // EAL-faktoren er altid 10 (fast ved lov) – vises som heltal uden decimaler
    formatAsAmount(computation.kapitaliseringsfaktor, 0),
    rowOpts
  );

  writer.writeLeftRightText(
    `Erhvervsevnetab (${formatKr(toKroner(computation.reguleretAarsloenOre))} x 10 x ${formatPct(computation.eetPct)}) =`,
    formatKr(toKroner(computation.eetBeregnetOre)),
    rowOpts
  );

  writer.writeLeftRightText(
    `Maksimalt erhvervsevnetab i beregningsåret ${computation.beregningsaar}`,
    formatKr(toKroner(computation.eetMaksOre)),
    rowOpts
  );

  writer.writeLeftRightText(
    resolveErhvervsevnetabMaksimumTekst(computation.eetReduceretTilMaks),
    formatKr(toKroner(computation.eetAnvendtOre)),
    { rightFontStyle: 'bold' as const }
  );

  writer.writeBoldSubheader('Aldersreduktion');

  writer.writeLeftRightText(
    'Fødselsdato',
    formatISOToDanish(computation.fodselsdato),
    rowOpts
  );

  writer.writeLeftRightText(
    `Alder på ${datoReference.tidspunkt}`,
    `${computation.alderVedSkade} år`,
    rowOpts
  );

  const aldersreduktionEtiket = buildAldersreduktionEtiket(
    computation.alderVedSkade
  );

  writer.writeLeftRightText(
    aldersreduktionEtiket,
    formatPct(computation.aldersreduktionPct),
    rowOpts
  );

  writer.writeLeftRightText(
    `${formatKr(toKroner(computation.eetAnvendtOre))} x (${formatDeductionPercent(computation.aldersreduktionPct, formatPct(computation.aldersreduktionPct))}) =`,
    formatDeductionKr(toKroner(computation.aldersreduktionBeloebOre)),
    { rightFontStyle: 'bold' as const }
  );

  writer.writeBoldSubheader(BEREGNET_EET_EFTER_EAL_LABEL);

  // Forligssætningen indleder bundlinjens afsnit og har ikke sin egen underoverskrift – samme
  // opsætning som differencekravets «Differencekrav»-afsnit. Forliget hører til DENNE opgørelse:
  // fanens krav ER forligsgraden af det beregnede krav. I differencekravets bilag er
  // `computation.forlig` altid `null` (grafen sender `forlig: null`), og bilaget bærer i stedet én
  // linje om, at forliget anvendes på differencekravets bundlinje.
  if (computation.forlig) {
    writer.writeWrappedText(
      buildForligIndgaaetSaetning(
        computation.forlig.label,
        computation.forlig.dato ? formatIsoDateLong(computation.forlig.dato) : null
      )
    );
  }

  if (computation.forlig) {
    writer.writeLeftRightText(
      `${computation.forlig.label} x (${formatKr(toKroner(computation.eetAnvendtOre))} - ${formatKr(toKroner(computation.aldersreduktionBeloebOre))}) =`,
      formatKr(toKroner(computation.forlig.ealKravEfterForligOre)),
      { rightFontStyle: 'bold' as const }
    );
  } else {
    writer.writeLeftRightText(
      `${formatKr(toKroner(computation.eetAnvendtOre))} - ${formatKr(toKroner(computation.aldersreduktionBeloebOre))} =`,
      formatKr(toKroner(computation.ealKravOre)),
      { rightFontStyle: 'bold' as const }
    );
  }

  if (forligIndregnesIDifferencekravet) {
    // Linjen er en forudsætningsbemærkning og ikke en del af regnestykket ovenfor; spaceren giver den
    // luft, så den ikke læses som endnu en linje i bundlinjens afsnit.
    writer.addSectionSpacer();
    writer.writeWrappedText(FORLIG_INDREGNET_I_DIFFERENCEKRAVET_TEKST);
  }
};

export const generateEfterEalDocument = defineDocument<GenerateEfterEalDocumentParams>({
  title: 'EET efter EAL',
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    'EET efter EAL',
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, { computation }) => {
    renderEfterEalBody(writer, computation);
  },
});
