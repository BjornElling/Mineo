/**
 * PDF Generator for Forsørgertab
 *
 * Genererer PDF-specifikation for forsørgertabsberegning med:
 * - Side 1: Grundlæggende oplysninger + Beregnet forsørgertab (hvis tilgængeligt)
 * - Side 2 (betinget): EAL-krav
 * - Side 3 (betinget): ASL-ydelser
 */

import { resolvePdfSectionEndY, type BrevhovedData } from '../../shared/pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from '../../infrastructure/pdfWriter';
import { resolvePdfFileName } from '../../shared/pdfFormatUtils';
import { cellLeft, cellRight, createPdfTableHeaderCell, renderPdfTable } from '../../shared/pdfTableRenderer';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import { TODAY } from '../../../config/dateRanges';
import { formatKr, formatAsAmount, formatAsAmountTrimmed, formatCountWithUnit } from '../../../utils/formatUtils';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import type { ForsoergertabCalculation, ForsoergertabAslComputation } from '../../../domain/forsoergertab/forsoergertabTypes';
import type { EetEalComputation } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { buildAldersreduktionFormelTekst, formatPercentTrimmedFromRounded4 } from '../../../domain/erhvervsevnetab/eetEalCalculation';

export const buildForsoergertabPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('Forsørgertab', false, journalnr);

// ============================================================================
// Side 1: Grundlæggende oplysninger + Beregnet forsørgertab
// ============================================================================

type GrundlaeggendeData = Readonly<{
  beregningsdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  efterladteFodselsdato: ISODateString | undefined;
  koen: string | undefined;
  visKoenValg: boolean;
  aslAarsloen: number | undefined;
  ealAarsloen: number | undefined;
  virkningsdato: ISODateString | undefined;
  tilkendtForPeriodeAar: number | undefined;
}>;

const addGrundlaeggendeSection = (
  writer: PdfWriter,
  data: GrundlaeggendeData,
  visEal: boolean,
  visAsl: boolean
): void => {
  writer.writeBoldSubheader('Grundlæggende oplysninger');

  if (data.beregningsdato) {
    writer.writeLeftRightText('Beregningsdato', isoToDanish(data.beregningsdato) ?? '', {
      rightFontStyle: 'normal',
    });
  }

  if (data.skadelidteFodselsdato) {
    writer.writeLeftRightText('Skadelidtes fødselsdato', isoToDanish(data.skadelidteFodselsdato) ?? '', {
      rightFontStyle: 'normal',
    });
  }

  // Efterladtes fødselsdato indgår kun i ASL-beregningen
  if (visAsl && data.efterladteFodselsdato) {
    writer.writeLeftRightText(
      'Efterladte ægtefælle/samlevers fødselsdato',
      isoToDanish(data.efterladteFodselsdato) ?? '',
      { rightFontStyle: 'normal' }
    );
  }

  if (data.visKoenValg && data.koen) {
    writer.writeLeftRightText('Køn', data.koen, { rightFontStyle: 'normal' });
  }

  const hasAslIndhold =
    visAsl &&
    (data.aslAarsloen !== undefined || data.virkningsdato !== undefined || data.tilkendtForPeriodeAar !== undefined);

  if (hasAslIndhold) {
    writer.addSectionSpacer();
    writer.writeBoldSubheader('ASL-ydelse');
    if (data.aslAarsloen !== undefined) {
      writer.writeLeftRightText('Skadelidtes årsløn (efter ASL)', formatKr(data.aslAarsloen), {
        rightFontStyle: 'normal',
      });
    }
    if (data.virkningsdato) {
      writer.writeLeftRightText('Startdato for ASL-ydelse', isoToDanish(data.virkningsdato) ?? '', {
        rightFontStyle: 'normal',
      });
    }
    if (data.tilkendtForPeriodeAar !== undefined) {
      writer.writeLeftRightText('Tilkendt for periode', `${data.tilkendtForPeriodeAar} år`, {
        rightFontStyle: 'normal',
      });
    }
  }

  if (visEal && data.ealAarsloen !== undefined) {
    writer.addSectionSpacer();
    writer.writeBoldSubheader('EAL-ydelse');
    writer.writeLeftRightText('Skadelidtes årsløn (efter EAL)', formatKr(data.ealAarsloen), {
      rightFontStyle: 'normal',
    });
  }
};

const addBeregnedResultatSection = (writer: PdfWriter, result: ForsoergertabCalculation): void => {
  writer.addSectionSpacer();
  writer.writeBoldSubheader('Beregnet forsørgertab');

  writer.writeLeftRightText('EAL-krav', formatKr(result.ealKrav), { rightFontStyle: 'normal' });
  writer.writeLeftRightText('Løbende ydelser (efter ASL)', `- ${formatKr(result.aslLobendeYdelserTotal)}`, {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText('Kapitalbeløb (efter ASL)', `- ${formatKr(result.aslKapitalbelob)}`, {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText('Forsørgertabserstatning', formatKr(result.nettokrav), {
    rightFontStyle: 'bold',
  });
};

// ============================================================================
// Side 2: EAL-krav
// ============================================================================

const addEalSection = (writer: PdfWriter, eal: EetEalComputation, foersoergertabEalMinSats: number | null, foersoergertabForhoejtetTilMin: boolean): void => {
  writer.writeSectionHeader('EAL-krav');

  writer.writeBoldSubheader('Årsløn');
  writer.writeLeftRightText('Skadelidtes årsløn på skadestidspunktet', formatKr(eal.aarsloen), {
    rightFontStyle: 'normal',
  });

  if (eal.reguleringsaar.length > 0) {
    writer.writeLeftRightText(
      `Regulering fra skadesår ${eal.skadesaar} til beregningsår ${eal.beregningsaar}`,
      `+ ${formatPercentTrimmedFromRounded4(eal.reguleringsPctRounded4)} %`,
      { rightFontStyle: 'normal' }
    );
    writer.writeLeftRightText(
      `${formatKr(eal.aarsloen)} x (100 % + ${formatPercentTrimmedFromRounded4(eal.reguleringsPctRounded4)} %) (afrundet) =`,
      formatKr(eal.reguleretAarsloen),
      { rightFontStyle: 'normal' }
    );
  }

  writer.writeBoldSubheader('Erhvervsevnetab');
  writer.writeLeftRightText('Erstatningsprocent (jf. erstatningsansvarslovens § 13)', '30 %', {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText('Kapitaliseringsfaktor', String(eal.kapitaliseringsfaktor), {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText(
    `Beregnet forsørgertab (${formatKr(eal.reguleretAarsloen)} x ${eal.kapitaliseringsfaktor} x 30 %) =`,
    formatKr(eal.eetBeregnet),
    { rightFontStyle: 'normal' }
  );

  if (foersoergertabEalMinSats !== null) {
    writer.writeLeftRightText(
      `Mindste erstatningsniveau i beregningsåret ${eal.beregningsaar}`,
      formatKr(foersoergertabEalMinSats),
      { rightFontStyle: 'normal' }
    );
  }

  writer.writeLeftRightText(
    foersoergertabForhoejtetTilMin
      ? 'Det beregnede forsørgertab skal forhøjes til minimum, dvs. udgør'
      : 'Det beregnede forsørgertab skal ikke forhøjes, dvs. udgør',
    formatKr(eal.eetAnvendt),
    { rightFontStyle: 'normal' }
  );

  writer.writeBoldSubheader('Aldersreduktion');
  writer.writeLeftRightText(
    'Skadelidtes alder på skadestidspunkt',
    formatCountWithUnit(eal.alderVedSkade, 'år', 'år'),
    { rightFontStyle: 'normal' }
  );
  writer.writeLeftRightText(
    `Aldersreduktion ${buildAldersreduktionFormelTekst(eal.alderVedSkade)}`,
    `${eal.aldersreduktionPct} %`,
    { rightFontStyle: 'normal' }
  );
  writer.writeLeftRightText(
    `${formatKr(eal.eetAnvendt)} x (- ${eal.aldersreduktionPct} %) =`,
    `- ${formatKr(eal.aldersreduktionBeloeb)}`,
    { rightFontStyle: 'normal' }
  );

  writer.writeBoldSubheader('Beregnet EAL-krav');
  writer.writeLeftRightText(
    `${formatKr(eal.eetAnvendt)} - ${formatKr(eal.aldersreduktionBeloeb)} =`,
    formatKr(eal.ealKrav),
    { rightFontStyle: 'bold' }
  );
};

// ============================================================================
// Side 3: ASL-ydelser
// ============================================================================

const addAslSection = (writer: PdfWriter, asl: ForsoergertabAslComputation): void => {
  writer.writeSectionHeader('ASL-ydelser');

  writer.writeLeftRightText('Årsløn efter ASL', formatKr(asl.aslAarsloen), { rightFontStyle: 'normal' });

  writer.writeBoldSubheader('Løbende ydelse');
  writer.writeWrappedText(
    'Ydelsen udgør 30 % af afdødes årsløn, jf. ASL § 30, opreguleret til udbetalingsåret.'
  );

  if (asl.lobendeYdelser.length > 0) {
    const doc = writer.getDoc();
    const tableStartY = writer.getY();

    const body = [
      [
        createPdfTableHeaderCell('Fra-dato', 'left'),
        createPdfTableHeaderCell('Til-dato', 'left'),
        createPdfTableHeaderCell('Måneder', 'right'),
        createPdfTableHeaderCell('Månedlig ydelse', 'right'),
        createPdfTableHeaderCell('Ydelser i perioden', 'right'),
      ],
      ...asl.lobendeYdelser.map((raekke) => [
        cellLeft(isoToDanish(raekke.fraDato) ?? ''),
        cellLeft(isoToDanish(raekke.tilDato) ?? ''),
        cellRight(formatAsAmount(raekke.maaneder, 4)),
        cellRight(formatKr(raekke.maanedligYdelse, 0)),
        cellRight(formatKr(raekke.ydelseIAlt, 0)),
      ]),
    ];

    const finalY = renderPdfTable({
      doc,
      startY: tableStartY,
      body,
      hasHeaderRow: true,
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 40 },
        4: { cellWidth: 45 },
      },
    });

    writer.setY(resolvePdfSectionEndY(finalY, tableStartY));

    writer.writeLeftRightText('Løbende ydelser i alt', formatKr(asl.aslLobendeYdelserTotal), {
      rightFontStyle: 'bold',
    });
  } else {
    writer.writeLeftRightText('Løbende ydelser', 'Ingen', { rightFontStyle: 'normal' });
    writer.writeLeftRightText('Løbende ydelser i alt', '0 kr.', { rightFontStyle: 'bold' });
  }

  writer.writeBoldSubheader('Beregnet kapitalbeløb');
  writer.writeWrappedText('Der foretages proformakapitalisering af resterende løbende ydelser');

  if (asl.resterendeMaanederTotal === 0) {
    writer.writeLeftRightText('Resterende periode', 'Ingen', { rightFontStyle: 'normal' });
    writer.writeLeftRightText('Kapitalbeløb', '0 kr.', { rightFontStyle: 'bold' });
  } else {
    writer.writeLeftRightText(
      `Årlig ydelse i ${asl.beregningsaar}-værdi: 30 % x ${formatKr(asl.benyttetAarsloen)} × (${formatAsAmountTrimmed(asl.aarsloenMaxBeregningsaar, 0)} / ${formatAsAmountTrimmed(asl.aarsloenMaxSkadesaar, 0)}) =`,
      formatKr(asl.opreguleretAarligYdelse, 2),
      { rightFontStyle: 'normal' }
    );
    writer.writeLeftRightText(
      'Resterende periode',
      `${formatCountWithUnit(asl.resterendeAar, 'år', 'år')} og ${formatCountWithUnit(asl.resterendeMaaneder, 'måned', 'måneder')}`,
      { rightFontStyle: 'normal' }
    );
    writer.writeLeftRightText(
      'Efterladtes alder på beregningsdatoen',
      formatCountWithUnit(asl.alderHeleAar, 'år', 'år'),
      { rightFontStyle: 'normal' }
    );

    if (asl.harNaaetFolkepensionsalder) {
      writer.writeLeftRightText('Folkepensionsalder', asl.folkepensionsalderAarLabel, {
        rightFontStyle: 'normal',
      });
      writer.writeLeftRightText(
        'Værdien af løbende ydelser efter folkepensionsalderen udgør',
        '0 kr.',
        { rightFontStyle: 'bold' }
      );
    } else {
      writer.writeLeftRightText(
        'Kapitaliseringsbekendtgørelse',
        asl.kapitaliseringsTabel
          ? `Vejl. ${asl.kapitaliseringsbekendtgoerelseId}, tabel ${asl.kapitaliseringsTabel}`
          : `Vejl. ${asl.kapitaliseringsbekendtgoerelseId}`,
        { rightFontStyle: 'normal' }
      );

      if (asl.kapitaliseringsTabelKoensopdelt && asl.koen) {
        writer.writeLeftRightText('Køn', asl.koen, { rightFontStyle: 'normal' });
      }

      if (asl.kapitalfaktor !== null) {
        writer.writeLeftRightText(
          'Kapitalfaktor',
          formatAsAmountTrimmed(asl.kapitalfaktor, 3),
          { rightFontStyle: 'normal' }
        );
        writer.writeLeftRightText(
          `Beregnet kapitalbeløb (${formatKr(asl.opreguleretAarligYdelse, 2)} x ${formatAsAmountTrimmed(asl.kapitalfaktor, 3)})`,
          formatKr(asl.kapitalbelob),
          { rightFontStyle: 'bold' }
        );
      }
    }
  }
};

// ============================================================================
// Hoved-generator
// ============================================================================

export type GenerateForsoergertabPdfParams = PdfCommonOptions &
  Readonly<{
    grundlaeggende: GrundlaeggendeData;
    result: ForsoergertabCalculation | null;
    ealComputation: EetEalComputation | null;
    aslComputation: ForsoergertabAslComputation | null;
    foersoergertabEalMinSats: number | null;
    foersoergertabForhoejtetTilMin: boolean;
  }>;

export const generateForsoergertabPdf = (params: GenerateForsoergertabPdfParams): void => {
  const {
    grundlaeggende,
    result,
    ealComputation,
    aslComputation,
    foersoergertabEalMinSats,
    foersoergertabForhoejtetTilMin,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: 'Forsørgertab',
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

  // --- Side 1 ---
  writer.writeTitle('Forsørgertab');

  addGrundlaeggendeSection(writer, grundlaeggende, ealComputation !== null, aslComputation !== null);

  if (result !== null) {
    addBeregnedResultatSection(writer, result);
  }

  // --- Side 2: EAL ---
  if (ealComputation !== null) {
    writer.addPage();
    addEalSection(writer, ealComputation, foersoergertabEalMinSats, foersoergertabForhoejtetTilMin);
  }

  // --- Side 3: ASL ---
  if (aslComputation !== null) {
    writer.addPage();
    addAslSection(writer, aslComputation);
  }

  writer.addFooter();
  writer.save(buildForsoergertabPdfFilename(stamdata?.journalnr));
};
