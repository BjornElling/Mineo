/**
 * PDF Generator for EET efter EAL i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af EAL-kravsberegningen.
 * Al indhold er på én side (ingen tabeller i UI'en).
 */

import { type BrevhovedData } from '../../shared/pdfHelpers';
import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import type { EetEalComputation } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { formatPercentTrimmedFromRounded4, buildAldersreduktionFormelTekst } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import { TODAY } from '../../../config/dateRanges';
import { resolvePdfFileName } from '../../shared/pdfFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import { formatKrEet as formatKr } from '../eet/eetPdfUtils';

const formatPct = (value: number): string => `${formatPercentTrimmedFromRounded4(value)} %`;

export const buildEfterEalPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('EET efter EAL', false, journalnr);

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

type GenerateEfterEalPdfParams = PdfCommonOptions &
  Readonly<{
    computation: EetEalComputation;
  }>;

export const renderEfterEalBody = (
  writer: ReturnType<typeof createStandardPdfWriter>,
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
    formatKr(computation.aarsloen),
    rowOpts
  );

  if (computation.reguleringsaar.length > 0) {
    writer.writeLeftRightText(
      `Regulering fra skadesår ${computation.skadesaar} til beregningsår ${computation.beregningsaar}`,
      `+ ${formatPct(computation.reguleringsPctRounded4)}`,
      rowOpts
    );

    writer.writeLeftRightText(
      `${formatKr(computation.aarsloen)} x (100 % + ${formatPct(computation.reguleringsPctRounded4)}) (afrundet) =`,
      formatKr(computation.reguleretAarsloen),
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
    `Erhvervsevnetab (${formatKr(computation.reguleretAarsloen)} x 10 x ${formatPct(computation.eetPct)}) =`,
    formatKr(computation.eetBeregnet),
    rowOpts
  );

  writer.writeLeftRightText(
    `Maksimalt erhvervsevnetab i beregningsåret ${computation.beregningsaar}`,
    formatKr(computation.eetMaks),
    rowOpts
  );

  writer.writeLeftRightText(
    computation.eetReduceretTilMaks
      ? 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'
      : 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør',
    formatKr(computation.eetAnvendt),
    { rightFontStyle: 'bold' as const }
  );

  writer.writeBoldSubheader('Aldersreduktion');

  writer.writeLeftRightText(
    'Fødselsdato',
    formatIsoDateShort(computation.fodselsdato),
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
    `${formatKr(computation.eetAnvendt)} x (- ${formatPct(computation.aldersreduktionPct)}) =`,
    `- ${formatKr(computation.aldersreduktionBeloeb)}`,
    { rightFontStyle: 'bold' as const }
  );

  writer.writeBoldSubheader('Beregnet EAL-krav');

  writer.writeLeftRightText(
    `${formatKr(computation.eetAnvendt)} - ${formatKr(computation.aldersreduktionBeloeb)} =`,
    formatKr(computation.ealKrav),
    { rightFontStyle: 'bold' as const }
  );
};

export const generateEfterEalPdf = (params: GenerateEfterEalPdfParams): void => {
  const { computation, stamdata, visBrevhoved = false } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: 'EET efter EAL',
    subject: 'Erstatningsberegning',
    author: 'MinEO',
    creator: 'mineo.dk',
  });

  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  writer.writeTitle('EET efter EAL');

  renderEfterEalBody(writer, computation);

  writer.addFooter();
  writer.save(buildEfterEalPdfFilename(stamdata?.journalnr));
};
