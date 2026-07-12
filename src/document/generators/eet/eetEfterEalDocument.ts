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
import { buildAldersreduktionFormelTekst } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import { formatKrEet as formatKr } from './eetDocumentUtils';
import { formatPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { toKroner } from '../../../domain/money/money';

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

type GenerateEfterEalDocumentParams = DocumentCommonOptions &
  Readonly<{
    computation: EetEalComputation;
  }>;

export const renderEfterEalBody = (
  writer: DocumentComposer,
  computation: EetEalComputation,
  includeBeregningsdatoHeader = true
): void => {
  const rowOpts = { rightFontStyle: 'normal' as const };

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

  writer.writeLeftRightText(
    'Årsløn på skadestidspunktet',
    formatKr(toKroner(computation.aarsloenOre)),
    rowOpts
  );

  if (computation.reguleringsaar.length > 0) {
    writer.writeLeftRightText(
      `Regulering fra skadesår ${computation.skadesaar} til beregningsår ${computation.beregningsaar}`,
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
    'Endeligt erhvervsevnetab',
    formatPct(computation.eetPct),
    rowOpts
  );

  writer.writeLeftRightText(
    'Kapitaliseringsfaktor',
    // EAL-faktoren er altid 10 (fast ved lov) — vises som heltal uden decimaler
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
    computation.eetReduceretTilMaks
      ? 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'
      : 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør',
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
    'Alder på skadestidspunkt',
    `${computation.alderVedSkade} år`,
    rowOpts
  );

  const aldersreduktionFormula = buildAldersreduktionFormelTekst(
    computation.alderVedSkade
  );

  writer.writeLeftRightText(
    `Aldersreduktion ${aldersreduktionFormula}`,
    formatPct(computation.aldersreduktionPct),
    rowOpts
  );

  writer.writeLeftRightText(
    `${formatKr(toKroner(computation.eetAnvendtOre))} x (- ${formatPct(computation.aldersreduktionPct)}) =`,
    `- ${formatKr(toKroner(computation.aldersreduktionBeloebOre))}`,
    { rightFontStyle: 'bold' as const }
  );

  writer.writeBoldSubheader('Beregnet EAL-krav');

  writer.writeLeftRightText(
    `${formatKr(toKroner(computation.eetAnvendtOre))} - ${formatKr(toKroner(computation.aldersreduktionBeloebOre))} =`,
    formatKr(toKroner(computation.ealKravOre)),
    { rightFontStyle: 'bold' as const }
  );
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
