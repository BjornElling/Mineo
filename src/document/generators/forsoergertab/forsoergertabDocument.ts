/**
 * PDF Generator for Forsørgertab
 *
 * Genererer PDF-specifikation for forsørgertabsberegning med:
 * - Grundlæggende oplysninger + Beregnet forsørgertab (hvis tilgængeligt)
 * - EAL-krav (betinget)
 * - ASL-ydelser (betinget)
 *
 * Sidebruddene sættes efter indholdet: er der KUN én ydelsesdel at specificere, står hele
 * specifikationen på siden med de grundlæggende oplysninger. Er der to, får hver sin side.
 */

import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { formatKr, formatAsAmount, formatAsAmountTrimmed, formatCountWithUnit, formatPercentRounded4, formatPercentTrimmedFromRounded4 } from '../../../utils/formatUtils';
import { formatDeductionKr, formatDeductionPercent } from '../../../utils/deductionFormatting';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import type { Skadestype } from '../../../schemas/formSchemas/enumSchemas';
import type { ForsoergertabCalculation, ForsoergertabAslComputation, ForsoergertabEalPort } from '../../../domain/forsoergertab/forsoergertabTypes';
import { buildAldersreduktionEtiket } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { resolveErhvervsevnetabMaksimumTekst } from '../../../domain/erhvervsevnetab/eetMaksimumTekst';
import {
  FORSOERGERTAB_EAL_GRUNDPRINCIP,
  resolveForsoergertabMinimumTekst,
} from '../../../domain/forsoergertab/forsoergertabEalTekster';
import {
  resolveStamdataDatoReference,
  type StamdataDatoReference,
} from '../../../domain/policies/stamdataCalculations';
import { toKroner, type MoneyOre } from '../../../domain/money/money';
import {
  SKADELIDTES_AARSLOEN_ASL_LABEL,
  SKADELIDTES_AARSLOEN_EAL_LABEL,
} from '../../../domain/aslEalAarsloen/aarsloenLabels';
import { FORSOERGERTAB_RESTERENDE_PERIODE_LABEL } from '../../../domain/forsoergertab/forsoergertabLabels';

// ============================================================================
// Grundlæggende oplysninger + Beregnet forsørgertab
// ============================================================================

type GrundlaeggendeData = Readonly<{
  beregningsdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  /**
   * Sagens egen dato (BB-122). Dokumentet trykte den ikke, selv om skærmen viser den som anden række, og
   * selv om den styrer fire af beregningens opslag: ASL-årslønnens maksimum, opreguleringens kildeår,
   * kapitaliseringsbekendtgørelsen og tabelvalget. En modpart kunne derfor ikke efterregne
   * specifikationen, og papiret kunne ikke henføres til sagen. Varige méns dokument gjorde det rigtige på
   * nøjagtig samme sagsgrundlag; dette er en konvergens mod det, ikke et nyt design.
   */
  skadedato: ISODateString | undefined;
  /** Skadestypen afgør datoens navn i hele dokumentet (BB-121). */
  skadestype: Skadestype | undefined;
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
  visAsl: boolean,
  datoReference: StamdataDatoReference
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

  // Sagens dato med det skadestype-afledte navn – samme række som skærmens anden (BB-122).
  if (data.skadedato) {
    writer.writeLeftRightText(datoReference.label, isoToDanish(data.skadedato) ?? '', {
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

  // Fladen har to personer i sig; rækken navngiver sin person som de øvrige (BB-134).
  if (data.visKoenValg && data.koen) {
    writer.writeLeftRightText('Skadelidtes køn', data.koen, { rightFontStyle: 'normal' });
  }

  const hasAslIndhold =
    visAsl &&
    (data.aslAarsloen !== undefined || data.virkningsdato !== undefined || data.tilkendtForPeriodeAar !== undefined);

  if (hasAslIndhold) {
    // Underoverskriften self-spacer (B5.1/B6); en manuel spacer ville give tom linje i Word.
    writer.writeBoldSubheader('ASL-ydelse');
    if (data.aslAarsloen !== undefined) {
      writer.writeLeftRightText(SKADELIDTES_AARSLOEN_ASL_LABEL, formatKr(data.aslAarsloen), {
        rightFontStyle: 'normal',
      });
    }
    if (data.virkningsdato) {
      // Feltets ene navn (BB-120) – samme ord som skærmen og feltets grænsebesked.
      writer.writeLeftRightText('Virkningsdato', isoToDanish(data.virkningsdato) ?? '', {
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
    writer.writeLeftRightText(SKADELIDTES_AARSLOEN_EAL_LABEL, formatKr(data.ealAarsloen), {
      rightFontStyle: 'normal',
    });
  }
};

const addBeregnedResultatSection = (writer: DocumentComposer, result: ForsoergertabCalculation): void => {
  // Underoverskriften self-spacer (B5.1/B6); en manuel spacer ville give tom linje i Word.
  writer.writeBoldSubheader('Beregnet forsørgertab');

  writer.writeLeftRightText('EAL-krav', formatKr(result.ealKrav), { rightFontStyle: 'normal' });
  writer.writeLeftRightText('Løbende ydelser (efter ASL)', formatDeductionKr(result.aslLobendeYdelserTotal), {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText('Kapitalbeløb (efter ASL)', formatDeductionKr(result.aslKapitalbelob), {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText('Forsørgertabserstatning', formatKr(result.nettokrav), {
    rightFontStyle: 'bold',
  });
};

// ============================================================================
// EAL-krav
// ============================================================================

const addEalSection = (
  writer: DocumentComposer,
  eal: ForsoergertabEalPort,
  foersoergertabEalMinSatsOre: MoneyOre | null,
  foersoergertabForhoejtetTilMin: boolean,
  datoReference: StamdataDatoReference
): void => {
  writer.writeSectionHeader('EAL-krav');
  writer.writeWrappedText(FORSOERGERTAB_EAL_GRUNDPRINCIP);

  writer.writeBoldSubheader('Årsløn');
  writer.writeLeftRightText('Skadelidtes årsløn', formatKr(toKroner(eal.aarsloenOre)), {
    rightFontStyle: 'normal',
  });

  if (eal.reguleringsaar.length > 0) {
    writer.writeLeftRightText(
      `Regulering fra ${datoReference.aar} ${eal.skadesaar} til beregningsår ${eal.beregningsaar}`,
      `+ ${formatPercentTrimmedFromRounded4(eal.reguleringsPctRounded4)} %`,
      { rightFontStyle: 'normal' }
    );
    writer.writeLeftRightText(
      `${formatKr(toKroner(eal.aarsloenOre))} x (100 % + ${formatPercentTrimmedFromRounded4(eal.reguleringsPctRounded4)} %) (afrundet) =`,
      formatKr(toKroner(eal.reguleretAarsloenOre)),
      { rightFontStyle: 'normal' }
    );
  }

  writer.writeBoldSubheader('Fuldt erhvervsevnetab');
  writer.writeLeftRightText('Erhvervsevnetab', formatPercentRounded4(eal.eetPct), {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText('Kapitaliseringsfaktor', String(eal.kapitaliseringsfaktor), {
    rightFontStyle: 'normal',
  });
  writer.writeLeftRightText(
    `Erhvervsevnetab (${formatKr(toKroner(eal.reguleretAarsloenOre))} x ${eal.kapitaliseringsfaktor} x ${formatPercentRounded4(eal.eetPct)}) =`,
    formatKr(toKroner(eal.eetBeregnetOre)),
    { rightFontStyle: 'normal' }
  );
  writer.writeLeftRightText(
    `Maksimalt erhvervsevnetab i beregningsåret ${eal.beregningsaar}`,
    formatKr(toKroner(eal.eetMaksOre)),
    { rightFontStyle: 'normal' }
  );
  writer.writeLeftRightText(
    resolveErhvervsevnetabMaksimumTekst(eal.eetReduceretTilMaks),
    formatKr(toKroner(eal.eetAnvendtOre)),
    { rightFontStyle: 'normal' }
  );

  writer.writeBoldSubheader('Forsørgertab');
  writer.writeLeftRightText(
    'Erstatningsprocent',
    formatPercentRounded4(eal.forsoergertabPct),
    { rightFontStyle: 'normal' }
  );
  writer.writeLeftRightText(
    `Beregnet forsørgertab (${formatKr(toKroner(eal.eetAnvendtOre))} x ${formatPercentRounded4(eal.forsoergertabPct)}) =`,
    formatKr(toKroner(eal.forsoergertabBeregnetOre)),
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
    resolveForsoergertabMinimumTekst(foersoergertabForhoejtetTilMin),
    formatKr(toKroner(eal.forsoergertabAnvendtOre)),
    { rightFontStyle: 'normal' }
  );

  writer.writeBoldSubheader('Aldersreduktion');
  writer.writeLeftRightText(
    `Skadelidtes alder på ${datoReference.tidspunkt}`,
    formatCountWithUnit(eal.alderVedSkade, 'år', 'år'),
    { rightFontStyle: 'normal' }
  );
  writer.writeLeftRightText(
    buildAldersreduktionEtiket(eal.alderVedSkade),
    `${eal.aldersreduktionPct} %`,
    { rightFontStyle: 'normal' }
  );
  writer.writeLeftRightText(
    `${formatKr(toKroner(eal.forsoergertabAnvendtOre))} x (${formatDeductionPercent(eal.aldersreduktionPct, `${eal.aldersreduktionPct} %`)}) =`,
    formatDeductionKr(toKroner(eal.aldersreduktionBeloebOre)),
    { rightFontStyle: 'normal' }
  );

  writer.writeBoldSubheader('Beregnet EAL-krav');
  writer.writeLeftRightText(
    `${formatKr(toKroner(eal.forsoergertabAnvendtOre))} - ${formatKr(toKroner(eal.aldersreduktionBeloebOre))} =`,
    formatKr(toKroner(eal.ealKravOre)),
    { rightFontStyle: 'bold' }
  );
};

// ============================================================================
// ASL-ydelser
// ============================================================================

const addAslSection = (writer: DocumentComposer, asl: ForsoergertabAslComputation): void => {
  writer.writeSectionHeader('ASL-ydelser');

  writer.writeLeftRightText(SKADELIDTES_AARSLOEN_ASL_LABEL, formatKr(asl.aslAarsloen), { rightFontStyle: 'normal' });

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
    writer.writeLeftRightText(FORSOERGERTAB_RESTERENDE_PERIODE_LABEL, 'Ingen', { rightFontStyle: 'normal' });
    writer.writeLeftRightText('Kapitalbeløb', '0 kr.', { rightFontStyle: 'bold' });
  } else {
    writer.writeLeftRightText(
      // Ét gangetegn i hele linjen (BB-132): den brugte før BÅDE `x` og `×` i samme sætning, som om de
      // to betød noget forskelligt. `x` er programmets tegn.
      `Årlig ydelse i ${asl.beregningsaar}-værdi: 30 % x ${formatKr(asl.benyttetAarsloen)} x (${formatAsAmountTrimmed(asl.aarsloenMaxBeregningsaar, 0)} / ${formatAsAmountTrimmed(asl.aarsloenMaxSkadesaar, 0)}) =`,
      formatKr(asl.opreguleretAarligYdelse, 2),
      { rightFontStyle: 'normal' }
    );
    writer.writeLeftRightText(
      FORSOERGERTAB_RESTERENDE_PERIODE_LABEL,
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
          // Afsluttende `=` som alle andre formellinjer med et resultat i højre kolonne (BB-132).
          `Beregnet kapitalbeløb (${formatKr(asl.opreguleretAarligYdelse, 2)} x ${formatAsAmountTrimmed(asl.kapitalfaktor, 3)}) =`,
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

  // Ét navnevalg for hele dokumentet, udledt af skadestypen (BB-121). Sektionerne må ikke udlede hver sit.
  //
  // Skadestypen kommer fra `grundlaeggende` og IKKE fra brevhovedets stamdata: brevhovedet projiceres kun,
  // når brugeren har slået det til, og navnet på sagens dato må ikke afhænge af den indstilling.
  const datoReference = resolveStamdataDatoReference(grundlaeggende.skadestype);

  const visEal = ealComputation !== null;
  const visAsl = aslComputation !== null;

  /**
   * Er der kun ÉN ydelsesdel at specificere, hører den på siden med de grundlæggende oplysninger:
   * en sag, der alene beregnes efter EAL, fyldte ellers to sider med luft nok til én. Er begge dele
   * med, får hver sin side, så de to specifikationer ikke løber sammen.
   */
  const specifikationPaaEgenSide = visEal && visAsl;

  addGrundlaeggendeSection(writer, grundlaeggende, visEal, visAsl, datoReference);

  if (result !== null) {
    addBeregnedResultatSection(writer, result);
  }

  if (ealComputation !== null) {
    if (specifikationPaaEgenSide) writer.addPage();
    addEalSection(
      writer,
      ealComputation,
      foersoergertabEalMinSatsOre,
      foersoergertabForhoejtetTilMin,
      datoReference
    );
  }

  if (aslComputation !== null) {
    if (specifikationPaaEgenSide) writer.addPage();
    addAslSection(writer, aslComputation);
  }

  },
});
