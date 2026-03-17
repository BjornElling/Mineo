/**
 * PDF Generator for Differencekrav i erhvervsevnetab
 *
 * Genererer et samlet PDF-dokument med differencekrav-beregningen som
 * første sektion, efterfulgt af valgfrie bilag:
 *  - Løbende ydelser (én side pr. afgørelse + valgfri udvidet spec.)
 *  - Kapitalisering (én side pr. afgørelse)
 *  - EET efter EAL (beregningssiden)
 *  - Proformakapitalisering af rest-EET
 *
 * Formatering af bilag følger slavisk de individuelle PDF-generatorer.
 * Beregningerne stammer fra differencekrav-beregningen (ikke fra de
 * individuelle faner), da der kan være mindre afvigelser (fx ophørsdato
 * for løbende ydelser = beregningsdato − 1 dag i differencekrav).
 */

import {
  PDF_BASE_LINE_HEIGHT_MM,
  type BrevhovedData,
} from './pdfHelpers';
import { MARGINS } from './pdfConfig';
import { createStandardPdfWriter } from './pdfWriter';
import { formatIsoDateLong, formatIsoDateShort } from '../dateFormatting';
import { formatAsAmount, formatAsAmountTrimmed } from '../formatUtils';
import type {
  EetDifferencekravComputation,
  EetDifferencekravProformaKapitalisering,
} from '../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { formatKapPct } from '../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { formatKapitaliseringsPct } from '../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import type { PdfCommonOptions } from './pdfOptions';
import { TODAY } from '../../config/dateRanges';
import { resolvePdfFileName } from './pdfFormatUtils';
import {
  addLoebendeAfgoerelseSection,
  addLoebendeYdelserEmptyState,
  addLoebendeUdvidetSpecifikationPage,
} from './loebendeYdelserPdf';
import {
  addKapitaliseringAfgoerelseSection,
  addKapitaliseringEmptyState,
} from './kapitaliseringPdf';
import { renderEfterEalBody } from './efterEalPdf';

const formatKr = (value: number, decimals = 0): string =>
  `${formatAsAmount(value, decimals)} kr.`;

const formatFaktor = (value: number): string => formatAsAmountTrimmed(value, 3);

const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

export const buildDifferencekravPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('Differencekrav (EET)', false, journalnr);

// ============================================================================
// PROFORMAKAPITALISERING-SEKTION
// ============================================================================

const addProformaKapitaliseringSection = (
  writer: ReturnType<typeof createStandardPdfWriter>,
  pk: EetDifferencekravProformaKapitalisering,
  koen: string | undefined
): void => {
  writer.addPage();

  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeSectionHeader(
    'Proformakapitalisering af rest-EET',
    PDF_BASE_LINE_HEIGHT_MM
  );

  writer.writeLeftRightTextSingleLine(
    'Kapitaliseringsdato',
    formatIsoDateShort(pk.kapitaliseringsdato),
    rowOpts
  );

  writer.writeSubheader('Grundydelse og regulering', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Proformakapitalisering',
    formatKapPct(pk.loebendeEetPct),
    rowOpts
  );

  writer.writeWrappedTextContinued(
    `Grundydelse (${formatKapPct(pk.loebendeEetPct)}): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) =`
  );
  writer.writeLeftRightText(
    `${formatKr(pk.grundloen, 0)} × ${formatKapPct(pk.loebendeEetPct)} × ${pk.erstatningsniveauPct} % × ${100 - pk.amBidragPct} % =`,
    formatKr(pk.grundydelse, 2),
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    `Reguleringsprocent (${formatIsoDateLong(pk.kapitaliseringsdato)})`,
    `${formatAsAmountTrimmed(pk.reguleringsPctRounded4, 4)} %`,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    `Årlig ydelse (${formatKr(pk.grundydelse, 2)} x ${formatAsAmountTrimmed(100 + pk.reguleringsPctRounded4, 4)} %)`,
    formatKr(pk.aarsydelse, 2),
    rowOpts
  );

  writer.writeSubheader('Kapitaliseringsbekendtgørelse og tabel', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Kapitaliseringsbekendtgørelse',
    pk.kapitaliseringsbekendtgoerelseLabel,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Alder ved proformakapitalisering',
    `${pk.alderAar} år, ${pk.alderMaaneder} måneder`,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Folkepensionsalder',
    pk.folkepensionsalderLabel,
    rowOpts
  );

  writer.writeLeftRightTextSingleLine(
    'Kapitaliseret pga. < 2 år til folkepension?',
    formatJaNej(pk.kapitaliseretPgaUnderToAarTilFp),
    rowOpts
  );

  if (pk.kapitaliseretPgaUnderToAarTilFp) {
    writer.writeLeftRightTextSingleLine(
      'Særfaktor (< 2 år til folkepension)',
      pk.saerfaktor === null ? '-' : formatFaktor(pk.saerfaktor),
      rowOpts
    );
  } else {
    writer.writeSubheader('Kapitaliseringsfaktor', PDF_BASE_LINE_HEIGHT_MM);

    writer.writeLeftRightTextSingleLine(
      'Faktor måneds-afhængig?',
      formatJaNej(pk.faktorMaanedsAfhaengig),
      rowOpts
    );

    if (pk.koenOpdelt && koen) {
      writer.writeLeftRightTextSingleLine('Køn', koen, rowOpts);
    }

    writer.writeLeftRightTextSingleLine(
      'Kapitaliseringsfaktor',
      formatFaktor(pk.kapitaliseringsfaktor),
      rowOpts
    );
  }

  writer.writeSubheader('Kapitalbeløb', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    `Beregnet proformakapitalisering (${formatKr(pk.aarsydelse, 2)} x ${formatFaktor(pk.kapitaliseringsfaktor)})`,
    formatKr(pk.proformaBeloeb),
    { rightFontStyle: 'bold' as const }
  );
};

// ============================================================================
// DIFFERENCEKRAV HOVED-SIDE
// ============================================================================

const renderDifferencekravPage = (
  writer: ReturnType<typeof createStandardPdfWriter>,
  computation: EetDifferencekravComputation
): void => {
  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeSectionHeader('Beregning', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Beregningsdato',
    formatIsoDateShort(computation.beregningsdato),
    rowOpts
  );

  // ── Specifikation ──────────────────────────────────────────────────────────

  writer.writeSectionHeader('Specifikation', PDF_BASE_LINE_HEIGHT_MM);

  // EAL-krav
  writer.writeSubheader('EAL-krav', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeWrappedText(
    `Erhvervsevnetabet udgør ${formatKapPct(computation.ealEetPct)}.`
  );
  writer.writeLeftRightTextSingleLine(
    'Det svarer til et beregnet erhvervsevnetab på:',
    formatKr(computation.ealKrav),
    rowOpts
  );

  // Løbende ASL-ydelser
  writer.writeSubheader('Løbende ASL-ydelser', PDF_BASE_LINE_HEIGHT_MM);

  if (computation.skadesdato < '2011-06-16') {
    writer.writeWrappedText('Skaden er indtrådt før 16. juni 2011.');
    writer.writeWrappedText(
      'Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser.'
    );
  } else {
    writer.writeWrappedText('Skaden er indtrådt den 16. juni 2011 eller senere.');
    writer.writeWrappedText(
      'Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser.'
    );
  }

  for (const afgoerelse of computation.afgoerelser) {
    const foretages = afgoerelse.fradragForetages;
    const pctLabel = foretages ? ` (${formatKapPct(afgoerelse.eetPct)})` : '';
    const typeLabel = (() => {
      if (afgoerelse.afgoerelseType === 'Midlertidig')
        return `Midlertidig afgørelse${foretages ? pctLabel : ''}`;
      if (afgoerelse.afgoerelseType === 'Delvist endelig')
        return `Delvist endelig afgørelse${foretages ? pctLabel : ''}`;
      return `Endelig afgørelse (${formatKapPct(afgoerelse.eetPct)})`;
    })();

    writer.writeUnderlinedLabel(`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`, MARGINS.left);
    writer.writeWrappedText(typeLabel);

    if (foretages && afgoerelse.beloeb > 0) {
      writer.writeLeftRightTextSingleLine(
        `Løbende ydelser (${formatIsoDateShort(afgoerelse.virkningsdato)} - ${formatIsoDateShort(afgoerelse.fradragesTil)}):`,
        `- ${formatKr(afgoerelse.beloeb)}`,
        rowOpts
      );
    } else if (!foretages) {
      writer.writeWrappedText('Løbende ydelser derfor ikke relevante.');
    } else {
      writer.writeWrappedText('Ingen løbende ydelser.');
    }
  }

  if (computation.afgoerelser.length === 0) {
    writer.writeWrappedText('Ingen afgørelser.');
  }

  // Kapitaliserede ASL-beløb
  writer.writeSubheader('Kapitaliserede ASL-beløb', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeWrappedText('Værdien af modtagne kapitalbeløb fratrækkes.');

  for (const afgoerelse of computation.kapitaliseringerAfgoerelser) {
    writer.writeUnderlinedLabel(`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`, MARGINS.left);

    if (
      afgoerelse.kapitalbelob !== null &&
      afgoerelse.kapitaliseringsdato !== null &&
      afgoerelse.kapitaliseringspct !== null
    ) {
      writer.writeLeftRightTextSingleLine(
        `Kapitaliseret (${formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)}) den ${formatIsoDateShort(afgoerelse.kapitaliseringsdato)}:`,
        `- ${formatKr(afgoerelse.kapitalbelob)}`,
        rowOpts
      );
    } else if (afgoerelse.kapitaliseringEfterBeregningsdato) {
      writer.writeWrappedText('Ikke kapitaliseret på beregningsdatoen.');
    } else {
      writer.writeWrappedText('Ikke kapitaliseret.');
    }
  }

  if (computation.kapitaliseringerAfgoerelser.length === 0) {
    writer.writeWrappedText('Ingen afgørelser.');
  }

  // Resterende erhvervsevnetab (proformakapitalisering)
  if (computation.proformaKapitalisering) {
    const pk = computation.proformaKapitalisering;

    writer.writeSubheader('Resterende erhvervsevnetab', PDF_BASE_LINE_HEIGHT_MM);

    writer.writeWrappedText('Der foretages fradrag med kapitaliseringsværdien af resterende EET.');
    writer.writeLeftRightTextSingleLine(
      `Proformakapitalisering (${formatKapPct(pk.loebendeEetPct)}) den ${formatIsoDateShort(pk.kapitaliseringsdato)}:`,
      `- ${formatKr(computation.proformaBeloeb)}`,
      rowOpts
    );
  }

  // Differencekrav
  writer.writeSubheader('Differencekrav', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightTextSingleLine(
    'Beregnet differencekrav',
    formatKr(computation.differencekrav),
    { rightFontStyle: 'bold' as const }
  );
};

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

export type BilagSelection = Readonly<{
  loebendeYdelser: boolean;
  kapitalisering: boolean;
  eetEfterEal: boolean;
  proformaKapitalisering: boolean;
  visUdvidetSpecifikationLoebendeYdelserBilag: boolean;
}>;

type GenerateDifferencekravPdfParams = PdfCommonOptions &
  Readonly<{
    computation: EetDifferencekravComputation;
    koen?: string;
    bilagSelection: BilagSelection;
  }>;

export const generateDifferencekravPdf = (
  params: GenerateDifferencekravPdfParams
): void => {
  const {
    computation,
    koen,
    bilagSelection,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: 'Differencekrav (EET)',
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

  writer.writeTitle('Differencekrav (EET)');

  // Hoved-side: differencekrav-beregningen
  renderDifferencekravPage(writer, computation);

  // Bilag: EET efter EAL
  if (bilagSelection.eetEfterEal && computation.ealComputation) {
    writer.addPage();
    writer.writeTitle('EET efter EAL');
    renderEfterEalBody(writer, computation.ealComputation, false);
  }

  // Bilag: Løbende ydelser (+ valgfri udvidet specifikation)
  if (bilagSelection.loebendeYdelser && computation.loebendeComputation) {
    const lc = computation.loebendeComputation;
    writer.addPage();
    writer.writeTitle('Løbende ydelser (EET)');
    if (lc.afgoerelser.length === 0) {
      addLoebendeYdelserEmptyState(writer);
    } else {
      lc.afgoerelser.forEach((afgoerelse, index) => {
        addLoebendeAfgoerelseSection(writer, afgoerelse, lc, index === 0);
      });
    }
    if (bilagSelection.visUdvidetSpecifikationLoebendeYdelserBilag) {
      addLoebendeUdvidetSpecifikationPage(writer, lc);
    }
  }

  // Bilag: Kapitalisering
  if (bilagSelection.kapitalisering && computation.kapComputation) {
    const kc = computation.kapComputation;
    writer.addPage();
    writer.writeTitle('Kapitalisering (EET)');
    if (kc.afgoerelser.length === 0) {
      addKapitaliseringEmptyState(writer);
    } else {
      kc.afgoerelser.forEach((afgoerelse, index) => {
        addKapitaliseringAfgoerelseSection(writer, afgoerelse, koen, index === 0);
      });
    }
  }

  // Bilag: Proformakapitalisering af rest-EET
  if (bilagSelection.proformaKapitalisering && computation.proformaKapitalisering) {
    addProformaKapitaliseringSection(writer, computation.proformaKapitalisering, koen);
  }

  writer.addFooter();
  writer.save(buildDifferencekravPdfFilename(stamdata?.journalnr));
};
