/**
 * PDF Generator for Forsørgertab
 *
 * Genererer PDF-specifikation for forsørgertabsberegning med:
 * - Side 1: Grundlæggende oplysninger + Beregnet forsørgertab (hvis tilgængeligt)
 * - Side 2 (betinget): EAL-krav
 * - Side 3 (betinget): ASL-ydelser
 */

import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { formatKr, formatAsAmount, formatAsAmountTrimmed, formatCountWithUnit, formatPercentTrimmedFromRounded4 } from '../../../utils/formatUtils';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import type { ForsoergertabCalculation, ForsoergertabAslComputation, ForsoergertabEalPort } from '../../../domain/forsoergertab/forsoergertabTypes';
import { buildAldersreduktionFormelTekst } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { toKroner, type MoneyOre } from '../../../domain/money/money';

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
  writer: DocumentComposer,
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
    // Underoverskriften self-spacer (B5.1/B6); en manuel spacer ville give tom linje i Word.
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
    // Underoverskriften self-spacer (B5.1/B6); en manuel spacer ville give tom linje i Word.
    writer.writeBoldSubheader('EAL-ydelse');
    writer.writeLeftRightText('Skadelidtes årsløn (efter EAL)', formatKr(data.ealAarsloen), {
      rightFontStyle: 'normal',
    });
  }
};

const addBeregnedResultatSection = (writer: DocumentComposer, result: ForsoergertabCalculation): void => {
  // Underoverskriften self-spacer (B5.1/B6); en manuel spacer ville give tom linje i Word.
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

const addEalSection = (writer: DocumentComposer, eal: ForsoergertabEalPort, foersoergertabEalMinSatsOre: MoneyOre | null, foersoergertabForhoejtetTilMin: boolean): void => {
  writer.writeSectionHeader('EAL-krav');

  writer.writeBoldSubheader('Årsløn');
  writer.writeLeftRightText('Skadelidtes årsløn på skadestidspunktet', formatKr(toKroner(eal.aarsloenOre)), {
    rightFontStyle: 'normal',
  });

  if (eal.reguleringsaar.length > 0) {
    writer.writeLeftRightText(
      `Regulering fra skadesår ${eal.skadesaar} til beregningsår ${eal.beregningsaar}`,
      `+ ${formatPercentTrimmedFromRounded4(eal.reguleringsPctRounded4)} %`,
      { rightFontStyle: 'normal' }
    );
    writer.writeLeftRightText(
      `${formatKr(toKroner(eal.aarsloenOre))} x (100 % + ${formatPercentTrimmedFromRounded4(eal.reguleringsPctRounded4)} %) (afrundet) =`,
      formatKr(toKroner(eal.reguleretAarsloenOre)),
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
    `Beregnet forsørgertab (${formatKr(toKroner(eal.reguleretAarsloenOre))} x ${eal.kapitaliseringsfaktor} x 30 %) =`,
    formatKr(toKroner(eal.eetBeregnetOre)),
    { rightFontStyle: 'normal' }
  );

  if (foersoergertabEalMinSatsOre !== null) {
    writer.writeLeftRightText(
      `Mindste erstatningsniveau i beregningsåret ${eal.beregningsaar}`,
      formatKr(toKroner(foersoergertabEalMinSatsOre)),
      { rightFontStyle: 'normal' }
    );
  }

  writer.writeLeftRightText(
    foersoergertabForhoejtetTilMin
      ? 'Det beregnede forsørgertab skal forhøjes til minimum, dvs. udgør'
      : 'Det beregnede forsørgertab skal ikke forhøjes, dvs. udgør',
    formatKr(toKroner(eal.eetAnvendtOre)),
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
    `${formatKr(toKroner(eal.eetAnvendtOre))} x (- ${eal.aldersreduktionPct} %) =`,
    `- ${formatKr(toKroner(eal.aldersreduktionBeloebOre))}`,
    { rightFontStyle: 'normal' }
  );

  writer.writeBoldSubheader('Beregnet EAL-krav');
  writer.writeLeftRightText(
    `${formatKr(toKroner(eal.eetAnvendtOre))} - ${formatKr(toKroner(eal.aldersreduktionBeloebOre))} =`,
    formatKr(toKroner(eal.ealKravOre)),
    { rightFontStyle: 'bold' }
  );
};

// ============================================================================
// Side 3: ASL-ydelser
// ============================================================================

const addAslSection = (writer: DocumentComposer, asl: ForsoergertabAslComputation): void => {
  writer.writeSectionHeader('ASL-ydelser');

  writer.writeLeftRightText('Årsløn efter ASL', formatKr(asl.aslAarsloen), { rightFontStyle: 'normal' });

  writer.writeBoldSubheader('Løbende ydelse');
  writer.writeWrappedText(
    'Ydelsen udgør 30 % af afdødes årsløn, jf. ASL § 30, opreguleret til udbetalingsåret.'
  );

  if (asl.lobendeYdelser.length > 0) {
    // Faste kolonnebredder (inline-litteral tidligere): to venstre dato-kolonner,
    // tre højrejusterede tal-kolonner. Justering defineret på kolonnerne.
    const columns: readonly ColumnSpec[] = [
      { width: { kind: 'fixed', mm: 30 }, align: 'left' },
      { width: { kind: 'fixed', mm: 30 }, align: 'left' },
      { width: { kind: 'fixed', mm: 25 }, align: 'right' },
      { width: { kind: 'fixed', mm: 40 }, align: 'right' },
      { width: { kind: 'fixed', mm: 45 }, align: 'right' },
    ];

    const rows: RowSpec[] = [
      {
        kind: 'header',
        cells: [
          { text: 'Fra-dato' },
          { text: 'Til-dato' },
          { text: 'Måneder' },
          { text: 'Månedlig ydelse' },
          { text: 'Ydelser i perioden' },
        ],
      },
      ...asl.lobendeYdelser.map((raekke): RowSpec => ({
        cells: [
          { text: isoToDanish(raekke.fraDato) ?? '' },
          { text: isoToDanish(raekke.tilDato) ?? '' },
          { text: formatAsAmount(raekke.maaneder, 4) },
          { text: formatKr(raekke.maanedligYdelse, 0) },
          { text: formatKr(raekke.ydelseIAlt, 0) },
        ],
      })),
    ];

    writer.addTable({ columns, hasHeaderRow: true, rows });

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
      writer.writeLeftRightText('Folkepensionsalder', asl.folkepensionsalderLabel, {
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

export type GenerateForsoergertabDocumentParams = DocumentCommonOptions &
  Readonly<{
    grundlaeggende: GrundlaeggendeData;
    result: ForsoergertabCalculation | null;
    ealComputation: ForsoergertabEalPort | null;
    aslComputation: ForsoergertabAslComputation | null;
    foersoergertabEalMinSatsOre: MoneyOre | null;
    foersoergertabForhoejtetTilMin: boolean;
  }>;

export const generateForsoergertabDocument = defineDocument<GenerateForsoergertabDocumentParams>({
  title: 'Forsørgertab',
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    'Forsørgertab',
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, params) => {
  const {
    grundlaeggende,
    result,
    ealComputation,
    aslComputation,
    foersoergertabEalMinSatsOre,
    foersoergertabForhoejtetTilMin,
  } = params;

  addGrundlaeggendeSection(writer, grundlaeggende, ealComputation !== null, aslComputation !== null);

  if (result !== null) {
    addBeregnedResultatSection(writer, result);
  }

  // --- Side 2: EAL ---
  if (ealComputation !== null) {
    writer.addPage();
    addEalSection(writer, ealComputation, foersoergertabEalMinSatsOre, foersoergertabForhoejtetTilMin);
  }

  // --- Side 3: ASL ---
  if (aslComputation !== null) {
    writer.addPage();
    addAslSection(writer, aslComputation);
  }

  },
});
