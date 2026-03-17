/**
 * PDF Generator for Kapitalisering i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af kapitaliserede EET-afgørelser.
 * Hver afgørelse renderes på sin egen side.
 */

import {
  PDF_BASE_LINE_HEIGHT_MM,
  type BrevhovedData,
} from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { formatIsoDateLong, formatIsoDateShort } from '../dateFormatting';
import { formatAsAmount, formatAsAmountTrimmed } from '../formatUtils';
import type {
  EetKapitaliseringAfgoerelseComputation,
  EetKapitaliseringComputation,
} from '../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { formatKapitaliseringsPct } from '../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import type { PdfCommonOptions } from './pdfOptions';
import { TODAY } from '../../config/dateRanges';
import { resolvePdfFileName } from './pdfFormatUtils';

const formatKr = (value: number, decimals = 0): string =>
  `${formatAsAmount(value, decimals)} kr.`;

const formatFaktor = (value: number): string => formatAsAmount(value, 3);

const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

export const buildKapitaliseringPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('Kapitalisering (EET)', false, journalnr);

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

  writer.writeLeftRightTextSingleLine(
    'Kapitaliseringsdato',
    formatIsoDateShort(afgoerelse.kapitaliseringsdato),
    rowOpts
  );

  writer.writeSubheader('Grundydelse og regulering', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Kapitalisering',
    formatKapitaliseringsPct(afgoerelse.kapitaliseringspct),
    rowOpts
  );

  writer.writeWrappedTextContinued(
    `Grundydelse (${formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)}): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) =`
  );
  writer.writeLeftRightText(
    `${formatKr(afgoerelse.grundloen, 0)} × ${formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)} × ${afgoerelse.erstatningsniveauPct} % × ${100 - afgoerelse.amBidragPct} % =`,
    formatKr(afgoerelse.grundydelse, 2),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    `Reguleringsprocent (${formatIsoDateLong(afgoerelse.kapitaliseringsdato)})`,
    `${formatAsAmountTrimmed(afgoerelse.reguleringsPctRounded4, 4)} %`,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    `Årlig ydelse (${formatKr(afgoerelse.grundydelse, 2)} x ${formatAsAmountTrimmed(100 + afgoerelse.reguleringsPctRounded4, 4)} %)`,
    formatKr(afgoerelse.aarsydelse, 2),
    rowOpts
  );

  writer.writeSubheader('Kapitaliseringsbekendtgørelse og tabel', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Kapitaliseringsbekendtgørelse',
    afgoerelse.kapitaliseringsbekendtgoerelseLabel,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Alder ved kapitalisering',
    `${afgoerelse.alderAar} år, ${afgoerelse.alderMaaneder} måneder`,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Folkepensionsalder',
    afgoerelse.folkepensionsalderLabel,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Kapitaliseret pga. < 2 år til folkepension?',
    formatJaNej(afgoerelse.kapitaliseretPgaUnderToAarTilFp),
    rowOpts
  );

  if (afgoerelse.kapitaliseretPgaUnderToAarTilFp) {
    writer.writeLeftRightTextSingleLine(
      'Særfaktor (< 2 år til folkepension)',
      afgoerelse.saerfaktor === null ? '-' : formatFaktor(afgoerelse.saerfaktor),
      rowOpts
    );
  } else {
    writer.writeSubheader('Kapitaliseringsfaktor', PDF_BASE_LINE_HEIGHT_MM);

    writer.writeLeftRightTextSingleLine(
      'Faktor måneds-afhængig?',
      formatJaNej(afgoerelse.faktorMaanedsAfhaengig),
      rowOpts
    );

    if (afgoerelse.koenOpdelt && koen) {
      writer.writeLeftRightTextSingleLine('Køn', koen, rowOpts);
    }

    writer.writeLeftRightTextSingleLine(
      'Kapitaliseringsfaktor',
      formatFaktor(afgoerelse.kapitaliseringsfaktor),
      rowOpts
    );
  }

  writer.writeSubheader('Kapitalbeløb', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
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

  // Én side pr. afgørelse
  computation.afgoerelser.forEach((afgoerelse, index) => {
    addKapitaliseringAfgoerelseSection(writer, afgoerelse, koen, index === 0);
  });

  writer.addFooter();
  writer.save(buildKapitaliseringPdfFilename(stamdata?.journalnr));
};
