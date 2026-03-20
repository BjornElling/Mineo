/**
 * PDF Generator for EET efter EAL i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af EAL-kravsberegningen.
 * Al indhold er på én side (ingen tabeller i UI'en).
 */

import {
  PDF_BASE_LINE_HEIGHT_MM,
  type BrevhovedData,
} from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { formatIsoDateLong, formatIsoDateShort } from '../dateFormatting';
import type { EetEalComputation } from '../../domain/erhvervsevnetab/eetEalCalculation';
import { formatPercentTrimmedFromRounded4, buildAldersreduktionFormelTekst } from '../../domain/erhvervsevnetab/eetEalCalculation';
import type { PdfCommonOptions } from './pdfOptions';
import { TODAY } from '../../config/dateRanges';
import { resolvePdfFileName } from './pdfFormatUtils';
import { formatAsAmount } from '../formatUtils';
import { formatKrEet as formatKr } from './eetPdfUtils';

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
    writer.writeSectionHeader('Beregning', PDF_BASE_LINE_HEIGHT_MM);

    writer.writeLeftRightTextSingleLine(
      'Beregningsdato',
      formatIsoDateLong(computation.beregningsdato),
      rowOpts
    );
  }

  // ── Specifikation ──────────────────────────────────────────────────────────

  writer.writeSectionHeader('Specifikation', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeSubheader('Årsløn', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Årsløn på skadestidspunktet',
    formatKr(computation.aarsloen),
    rowOpts
  );

  if (computation.reguleringsaar.length > 0) {
    writer.writeLeftRightTextSingleLine(
      `Regulering fra skadesår ${computation.skadesaar} til beregningsår ${computation.beregningsaar}`,
      `+ ${formatPct(computation.reguleringsPctRounded4)}`,
      rowOpts
    );

    writer.writeLeftRightTextSingleLine(
      `${formatKr(computation.aarsloen)} x (100 % + ${formatPct(computation.reguleringsPctRounded4)}) (afrundet) =`,
      formatKr(computation.reguleretAarsloen),
      rowOpts
    );
  }

  writer.writeSubheader('Erhvervsevnetab', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Endeligt erhvervsevnetab',
    formatPct(computation.eetPct),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Kapitaliseringsfaktor',
    // EAL-faktoren er altid 10 (fast ved lov) — vises som heltal uden decimaler
    formatAsAmount(computation.kapitaliseringsfaktor, 0),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    `Erhvervsevnetab (${formatKr(computation.reguleretAarsloen)} x 10 x ${formatPct(computation.eetPct)}) =`,
    formatKr(computation.eetBeregnet),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    `Maksimalt erhvervsevnetab i beregningsåret ${computation.beregningsaar}`,
    formatKr(computation.eetMaks),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    computation.eetReduceretTilMaks
      ? 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'
      : 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør',
    formatKr(computation.eetAnvendt),
    { rightFontStyle: 'bold' as const }
  );

  writer.writeSubheader('Aldersreduktion', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Fødselsdato',
    formatIsoDateShort(computation.fodselsdato),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Alder på skadestidspunkt',
    `${computation.alderVedSkade} år`,
    rowOpts
  );

  const aldersreduktionFormula = buildAldersreduktionFormelTekst(
    computation.alderVedSkade,
    computation.alderVedSkadeCapped
  );

  writer.writeLeftRightTextSingleLine(
    `Aldersreduktion ${aldersreduktionFormula}`,
    formatPct(computation.aldersreduktionPct),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    `${formatKr(computation.eetAnvendt)} x (- ${formatPct(computation.aldersreduktionPct)}) =`,
    `- ${formatKr(computation.aldersreduktionBeloeb)}`,
    { rightFontStyle: 'bold' as const }
  );

  writer.writeSubheader('Beregnet EAL-krav', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
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
    author: 'Mineo',
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
