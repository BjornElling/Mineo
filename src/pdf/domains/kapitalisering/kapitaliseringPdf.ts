/**
 * PDF Generator for Kapitalisering i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af kapitaliserede EET-afgørelser.
 * Hver afgørelse renderes på sin egen side.
 */

import {
  PDF_BASE_LINE_HEIGHT_MM,
  type BrevhovedData,
} from '../../shared/pdfHelpers';
import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { formatAsAmountTrimmed } from '../../../utils/formatUtils';
import type {
  EetKapitaliseringAfgoerelseComputation,
  EetKapitaliseringComputation,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { formatKapitaliseringsPct } from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import { TODAY } from '../../../config/dateRanges';
import { resolvePdfFileName } from '../../shared/pdfFormatUtils';
import { formatFaktorEet as formatFaktor, formatJaNejEet as formatJaNej, formatKrEet as formatKr } from '../eet/eetPdfUtils';

export const buildKapitaliseringPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('Kapitalisering (EET)', false, journalnr);

// Bevidst PDF-formulering: Vi viser "< 2 år" som en kortere og mere læsbar
// etikette i PDF'en, selv om særreglen også omfatter kontroltidspunktet præcis
// 2 år før folkepensionsalderen. PDF-teksten er derfor en præsentationsmæssig
// forenkling og må ikke bruges som normativ regeltekst eller som grundlag for
// ændring af beregningslogikken.
export const PDF_UNDER_TO_AAR_TIL_FOLKEPENSION_LABEL =
  'Kapitaliseret pga. < 2 år til folkepension?';

export const addKapitaliseringEmptyState = (
  writer: ReturnType<typeof createStandardPdfWriter>
): void => {
  writer.writeSectionHeader('Specifikation', PDF_BASE_LINE_HEIGHT_MM);
  writer.writeWrappedText('Der er ingen kapitaliserede afgørelser i sagen.');
};

// ============================================================================
// AFGØRELSE-SIDE
// ============================================================================

export const addKapitaliseringAfgoerelseSection = (
  writer: ReturnType<typeof createStandardPdfWriter>,
  afgoerelse: EetKapitaliseringAfgoerelseComputation,
  koen: string | undefined,
  isFirst: boolean
): void => {
  if (!isFirst) {
    writer.addPage();
  }

  writer.writeSectionHeader(
    `Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`,
    PDF_BASE_LINE_HEIGHT_MM
  );

  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeLeftRightText(
    'Kapitaliseringsdato',
    formatIsoDateShort(afgoerelse.kapitaliseringsdato),
    rowOpts
  );

  writer.writeBoldSubheader('Grundydelse og regulering', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightText(
    'Kapitalisering',
    formatKapitaliseringsPct(afgoerelse.kapitaliseringspct),
    rowOpts
  );

  writer.writeWrappedTextContinued(
    `${buildKapitaliseringGrundydelseLabel(
      formatKapitaliseringsPct(afgoerelse.kapitaliseringspct),
      afgoerelse.amBidragPct
    )} =`
  );
  writer.writeLeftRightText(
    buildKapitaliseringGrundydelseExpression(
      formatKr(afgoerelse.grundloen, 0),
      formatKapitaliseringsPct(afgoerelse.kapitaliseringspct),
      afgoerelse.erstatningsniveauPct,
      afgoerelse.amBidragPct
    ),
    formatKr(afgoerelse.grundydelse, 2),
    rowOpts
  );

  if (afgoerelse.grundydelse2024 !== null && afgoerelse.opreguleringTil2024PctRounded4 !== null) {
    writer.writeLeftRightText(
      buildKapitaliseringOpreguleringTil2024Expression(
        formatKr(afgoerelse.grundydelse, 2),
        formatAsAmountTrimmed(1 + afgoerelse.opreguleringTil2024PctRounded4 / 100, 4),
        `${formatAsAmountTrimmed(afgoerelse.opreguleringTil2024PctRounded4, 4)} %`
      ),
      formatKr(afgoerelse.grundydelse2024, 2),
      rowOpts
    );
  }

  if (afgoerelse.aarsydelseReguleringsPctRounded4 !== null) {
    writer.writeLeftRightText(
      `Reguleringsprocent (${formatIsoDateShort(afgoerelse.kapitaliseringsdato)})`,
      `${formatAsAmountTrimmed(afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`,
      rowOpts
    );
  }

  writer.writeLeftRightText(
    buildKapitaliseringAarsydelseExpression(
      formatKr(afgoerelse.aarsydelseGrundlag, 2),
      afgoerelse.aarsydelseReguleringsPctRounded4 === null
        ? null
        : `${formatAsAmountTrimmed(100 + afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`
    ),
    formatKr(afgoerelse.aarsydelse, 2),
    rowOpts
  );

  writer.writeBoldSubheader('Kapitaliseringsbekendtgørelse og tabel', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightText(
    'Kapitaliseringsbekendtgørelse',
    afgoerelse.kapitaliseringsbekendtgoerelseLabel,
    rowOpts
  );

  writer.writeLeftRightText(
    'Alder ved kapitalisering',
    `${afgoerelse.alderAar} år, ${afgoerelse.alderMaaneder} måneder`,
    rowOpts
  );

  writer.writeLeftRightText(
    'Folkepensionsalder',
    afgoerelse.folkepensionsalderLabel,
    rowOpts
  );

  writer.writeLeftRightText(
    PDF_UNDER_TO_AAR_TIL_FOLKEPENSION_LABEL,
    formatJaNej(afgoerelse.kapitaliseretPgaUnderToAarTilFp),
    rowOpts
  );

  if (afgoerelse.kapitaliseretPgaUnderToAarTilFp) {
    writer.writeLeftRightText(
      'Særfaktor (≤ 2 år til folkepension)',
      afgoerelse.saerfaktor === null ? '-' : formatFaktor(afgoerelse.saerfaktor),
      rowOpts
    );
  } else {
    writer.writeBoldSubheader('Kapitaliseringsfaktor', PDF_BASE_LINE_HEIGHT_MM);

    writer.writeLeftRightText(
      'Faktor måneds-afhængig?',
      formatJaNej(afgoerelse.faktorMaanedsAfhaengig),
      rowOpts
    );

    if (afgoerelse.koenOpdelt && koen) {
      writer.writeLeftRightText('Køn', koen, rowOpts);
    }

    writer.writeLeftRightText(
      'Kapitaliseringsfaktor',
      formatFaktor(afgoerelse.kapitaliseringsfaktor),
      rowOpts
    );
  }

  writer.writeBoldSubheader('Kapitalbeløb', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightText(
    `Beregnet kapitalbeløb (${formatKr(afgoerelse.aarsydelse, 2)} x ${formatFaktor(afgoerelse.kapitaliseringsfaktor)})`,
    formatKr(afgoerelse.kapitalbelob, 0),
    { rightFontStyle: 'bold' as const }
  );
};

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

type GenerateKapitaliseringPdfParams = PdfCommonOptions &
  Readonly<{
    computation: EetKapitaliseringComputation;
    koen?: string;
  }>;

export const generateKapitaliseringPdf = (
  params: GenerateKapitaliseringPdfParams
): void => {
  const {
    computation,
    koen,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: 'Kapitalisering (EET)',
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

  writer.writeTitle('Kapitalisering (EET)');

  if (computation.afgoerelser.length === 0) {
    addKapitaliseringEmptyState(writer);
  } else {
    // Én side pr. afgørelse
    computation.afgoerelser.forEach((afgoerelse, index) => {
      addKapitaliseringAfgoerelseSection(writer, afgoerelse, koen, index === 0);
    });
  }

  writer.addFooter();
  writer.save(buildKapitaliseringPdfFilename(stamdata?.journalnr));
};
