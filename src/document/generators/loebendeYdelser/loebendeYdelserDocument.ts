/**
 * PDF Generator for Løbende ydelser i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af løbende EET-ydelser.
 * Hver afgørelse renderes på sin egen side. Udvidet specifikation
 * (Grundløn, Ydelsesniveau) tilføjes på en separat slutside hvis valgt.
 */

import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { buildSummedTotalRowSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import type { ISODateString } from '../../../types/branded';
import type {
  EetLoebendeComputation,
  EetLoebendeAfgoerelseComputation,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import {
  formatPct,
  formatSkadedatoCompact,
  resolveLoebendeAfgoerelseRestVisning,
  toAfgoerelseTypeLabel,
  toOphoerAarsagLabel,
  visGrundydelseNiveauSkift,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { formatAsAmount } from '../../../utils/formatUtils';
import { resolveDocumentArtifactFileName, formatMaanederFixed, formatReguleringPct } from '../../layout/documentFormatUtils';
import { round4 } from '../../../utils/roundingShortcuts';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../../data/lovbestemteRates';
import { formatJaNejEet as formatJaNej, formatKrEet as formatKr } from '../eet/eetDocumentUtils';
import { toKroner } from '../../../domain/money/money';

const formatEetLabel = (eetPct: number, priorKapPct: number): string =>
  priorKapPct > 0
    ? `Erhvervsevnetab (${formatPct(eetPct)} - ${formatPct(priorKapPct)} tidligere kap.)`
    : 'Erhvervsevnetab';

const formatEetValue = (eetPct: number, priorKapPct: number): string =>
  priorKapPct > 0
    ? formatPct(Math.max(0, eetPct - priorKapPct))
    : formatPct(eetPct);

export const addLoebendeYdelserEmptyState = (
  writer: DocumentComposer
): void => {
  writer.writeSectionHeader('Specifikation');
  writer.writeWrappedText('Der er ingen afgørelser i sagen.');
};

// ============================================================================
// AFGØRELSE-SIDE
// ============================================================================

export const addLoebendeAfgoerelseSection = (
  writer: DocumentComposer,
  afgoerelse: EetLoebendeAfgoerelseComputation,
  computation: EetLoebendeComputation,
  isFirst: boolean
): void => {
  if (!isFirst) {
    writer.addPage();
  }

  const typeLabel = toAfgoerelseTypeLabel(
    afgoerelse.afgoerelseType,
    afgoerelse.harRestSektion,
    afgoerelse.harKapitalisering
  );

  writer.writeSectionHeader(
    `Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`
  );

  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeLeftRightText('Type', typeLabel, rowOpts);
  writer.writeLeftRightText(
    formatEetLabel(afgoerelse.eetPct, afgoerelse.priorKapPct),
    formatEetValue(afgoerelse.eetPct, afgoerelse.priorKapPct),
    rowOpts
  );

  if (afgoerelse.harKapitalisering && afgoerelse.kapitaliseringsdato) {
    const kapLabel = afgoerelse.harRestSektion
      ? `Delvist kapitaliseret (${formatPct(afgoerelse.kapPctAktuel)})`
      : 'Kapitaliseret';
    writer.writeLeftRightText(
      kapLabel,
      formatISOToDanish(afgoerelse.kapitaliseringsdato),
      rowOpts
    );
  }

  writer.writeLeftRightText('Årsløn', formatKr(toKroner(computation.benyttetAarsloenOre)), rowOpts);

  writer.writeBoldSubheader('Periodeafgrænsning');

  writer.writeLeftRightText('Afgørelsesdato', formatISOToDanish(afgoerelse.afgoerelsesdato), rowOpts);
  writer.writeLeftRightText('Virkningsdato', formatISOToDanish(afgoerelse.virkningsdato), rowOpts);
  writer.writeLeftRightText('Afgørelse med tilbagevirkende kraft?', formatJaNej(afgoerelse.tilbagevirkendeKraft), rowOpts);
  writer.writeLeftRightText('Løbende ydelse ophører', formatISOToDanish(afgoerelse.ophoerDato), rowOpts);
  writer.writeLeftRightText('Ophør skyldes', toOphoerAarsagLabel(afgoerelse.ophoerAarsag), rowOpts);

  // Ingen manuel addSectionSpacer her: underoverskriften "Beregnede ydelser" har selv den
  // kanoniske top-afstand (kontrakt B5.1/B6). I PDF absorberer writeBoldSubheader en evt.
  // forudgående spacer, så resultatet var korrekt; men i Word ville en spacer-paragraf
  // lægge sig oven i Heading2-typografiens before-spacing og give en synlig tom linje før
  // underoverskriften på hver afgørelses-side. Lad subheaderens centrale afstand stå alene.

  // Beregnede ydelser
  const viserGrundydelseNiveauSkift = visGrundydelseNiveauSkift(afgoerelse, computation.grundloenNiveau);
  const ingenLoebendeYdelse = afgoerelse.iAltBeregnetEetOre === 0;

  writer.writeBoldSubheader('Beregnede ydelser');

  if (viserGrundydelseNiveauSkift) {
    writer.writeWrappedText(
      'Frem til 1. januar 2024 beregnes grundydelsen i 2003-niveau og derefter i 2024-niveau.'
    );
    writer.addSectionSpacer();
  }
  if (ingenLoebendeYdelse) {
    writer.writeWrappedText('Afgørelsen giver ingen løbende ydelse i den valgte periode.');
    writer.addSectionSpacer();
  }
  if (!ingenLoebendeYdelse) {
    // Auto-brede kolonner: to centrerede dato-kolonner, fem højrejusterede tal-kolonner.
    const columns: readonly ColumnSpec[] = [
      { width: { kind: 'auto' }, align: 'center' },
      { width: { kind: 'auto' }, align: 'center' },
      { width: { kind: 'auto' }, align: 'right' },
      { width: { kind: 'auto' }, align: 'right' },
      { width: { kind: 'auto' }, align: 'right' },
      { width: { kind: 'auto' }, align: 'right' },
      { width: { kind: 'auto' }, align: 'right' },
    ];

    const dataRows: RowSpec[] = afgoerelse.perioder.map((row) => ({
      cells: [
        { text: formatISOToDanish(row.fra) },
        { text: formatISOToDanish(row.til) },
        { text: formatMaanederFixed(row.maanederPraecis) },
        { text: formatKr(toKroner(row.grundydelseAfrundetOre), 2) },
        { text: formatReguleringPct(row.reguleringPct) },
        { text: formatKr(toKroner(row.maanedligYdelseOre)) },
        { text: formatKr(toKroner(row.beregnetEetOre)) },
      ],
    }));

    const totalRow = buildSummedTotalRowSpec(
      'I alt',
      afgoerelse.perioder.map((row) => toKroner(row.beregnetEetOre)),
      {
        columnCount: 7,
        valueColumnIndex: 6,
        formatValue: (total) => formatKr(total),
        valueHasKrSuffix: true,
      }
    );
  writer.addTable({
      columns,
      hasHeaderRow: true,
      rows: [
        {
          kind: 'header',
          cells: [
            { text: 'Fra o.m.' },
            { text: 'Til o.m.' },
            { text: 'Mdr.' },
            { text: 'Grundydelse' },
            { text: 'Regulering' },
            { text: 'Ydelse/md.' },
            { text: 'Beregnet EET' },
          ],
        },
        ...dataRows,
        ...(totalRow ? [totalRow] : []),
      ],
    });
  }
};

// ============================================================================
// UDVIDET SPECIFIKATION-SIDE
// ============================================================================

export const addLoebendeUdvidetSpecifikationPage = (
  writer: DocumentComposer,
  computation: EetLoebendeComputation
): void => {
  writer.addPage();

  writer.writeSectionHeader('Udvidet specifikation');

  const rowOpts = { rightFontStyle: 'normal' as const };

  // Årsløn
  writer.writeBoldSubheader('Årsløn');
  const aslLabel = `ASL årsløn (afrundet til nærmeste 1000 og maks. ${formatAsAmount(toKroner(computation.maxAarsloenISkadesaarOre), 0)} kr.)`;
  writer.writeLeftRightText(aslLabel, formatKr(toKroner(computation.benyttetAarsloenOre)), rowOpts);

  // Grundløn
  writer.writeBoldSubheader('Grundløn');
  if (computation.grundloenNiveau === '2003') {
    writer.writeWrappedText('Skaden er sket før 1. juli 2024, og grundlønnen beregnes derfor i 2003-niveau.');
    writer.writeWrappedTextContinued(`Årsløn × (Maks. årsløn 1/1-2003 / Maks. årsløn ${formatSkadedatoCompact(computation.skadedato)}) =`);
    writer.writeLeftRightText(
      `${formatKr(toKroner(computation.benyttetAarsloenOre))} × (${formatAsAmount(ASL_MAX_AARSLOEN_2003, 0)} / ${formatAsAmount(toKroner(computation.maxAarsloenISkadesaarOre), 0)}) =`,
      formatKr(toKroner(computation.grundloenOre)),
      rowOpts
    );
  } else {
    writer.writeWrappedText('Skaden er sket fra 1. juli 2024, og grundlønnen beregnes derfor i 2024-niveau.');
    writer.writeWrappedTextContinued(`Årsløn × (Maks. årsløn 1/1-2024 / Maks. årsløn ${formatSkadedatoCompact(computation.skadedato)}) =`);
    writer.writeLeftRightText(
      `${formatKr(toKroner(computation.benyttetAarsloenOre))} × (${formatAsAmount(ASL_MAX_AARSLOEN_2024, 0)} / ${formatAsAmount(toKroner(computation.maxAarsloenISkadesaarOre), 0)}) =`,
      formatKr(toKroner(computation.grundloenOre)),
      rowOpts
    );
  }

  // Ydelsesniveau
  writer.writeBoldSubheader('Ydelsesniveau');
  if (computation.erstatningsniveauPct === 83) {
    writer.writeLeftRightText(
      'Da skaden er sket 1/1-2011 eller senere, udgør erstatningsniveauet',
      '83 %',
      rowOpts
    );
    writer.writeLeftRightText(
      'Der fratrækkes AM-bidrag (8 %) svarende til en yderligere regulering med',
      '92 %',
      rowOpts
    );
  } else {
    writer.writeLeftRightText(
      'Da skaden er før 1/1-2011, udgør erstatningsniveauet',
      '80 %',
      rowOpts
    );
    writer.writeWrappedText('Der trækkes ikke AM-bidrag fra årslønnen.');
  }

  // Grundydelse pr. afgørelse
  const reguleringFoer2024Pct = reguleringsprocentErhvervsevnetabFoer2024[2024] ?? 0;
  const reguleringFoer2024FaktorTekst = formatAsAmount(
    round4(1 + reguleringFoer2024Pct / 100),
    3
  );

  for (const afgoerelse of computation.afgoerelser) {
    const {
      show2024ConversionBlock: show2024Block,
      hasRestAfterKapBefore2024,
      showRest2003,
      showRest2024,
    } = resolveLoebendeAfgoerelseRestVisning(afgoerelse, computation.grundloenNiveau);

    const eetFaktor = formatEetValue(afgoerelse.eetPct, afgoerelse.priorKapPct);
    const grundydelseFormulaLine1 =
      computation.erstatningsniveauPct === 83
        ? 'Grundløn x EET x Erstatningsniveau x (100 % - AM-bidrag) ='
        : 'Grundløn x EET x Erstatningsniveau =';
    const grundydelseFormulaLine2 =
      computation.erstatningsniveauPct === 83
        ? `${formatKr(toKroner(computation.grundloenOre))} x ${eetFaktor} x 83 % x 92 % =`
        : `${formatKr(toKroner(computation.grundloenOre))} x ${eetFaktor} x 80 % =`;

    const primaryGrundydelse =
      computation.grundloenNiveau === '2024'
        ? afgoerelse.grundydelse2024FuldOre
        : afgoerelse.grundydelseFuldOre;

    const restGrundydelse2003 = afgoerelse.grundydelseRestOre ?? afgoerelse.grundydelseFuldOre;
    const restGrundydelse2024 = afgoerelse.grundydelse2024RestOre ?? afgoerelse.grundydelse2024FuldOre;
    const grundydelse2003BaseFor2024 = hasRestAfterKapBefore2024
      ? restGrundydelse2003
      : afgoerelse.grundydelseFuldOre;
    const grundydelse2024Result = hasRestAfterKapBefore2024
      ? restGrundydelse2024
      : afgoerelse.grundydelse2024FuldOre;

    writer.writeBoldSubheader(`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`);

    writer.writeLeftRightText(
      formatEetLabel(afgoerelse.eetPct, afgoerelse.priorKapPct),
      eetFaktor,
      rowOpts
    );

    const grundydelseHeading = show2024Block ? 'Grundydelse før 1. januar 2024' : 'Grundydelse';
    writer.writeUnderlinedSubheader(grundydelseHeading);
    writer.writeWrappedTextContinued(grundydelseFormulaLine1);
    writer.writeLeftRightText(grundydelseFormulaLine2, formatKr(toKroner(primaryGrundydelse), 2), rowOpts);

    if (showRest2003) {
      const restEetExpression = `${afgoerelse.eetPct} - ${formatPct(afgoerelse.kapPctAktuel)} = ${formatPct(afgoerelse.restEetPct)}`;
      const restTextPrefix =
        afgoerelse.kapitaliseringsdato !== null
          ? `Resterende EET (${restEetExpression}) efter kapitalisering ${formatISOToDanish(afgoerelse.kapitaliseringsdato as ISODateString)}`
          : 'Resterende EET efter kapitalisering';
      writer.writeLeftRightText(restTextPrefix, formatKr(toKroner(restGrundydelse2003), 2), rowOpts);
    }

    if (show2024Block) {
      writer.writeUnderlinedSubheader('Grundydelse fra 1. januar 2024');
      writer.writeWrappedTextContinued(`Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatPct(reguleringFoer2024Pct)}):`);
      writer.writeLeftRightText(
        `${formatKr(toKroner(grundydelse2003BaseFor2024), 2)} x ${reguleringFoer2024FaktorTekst} =`,
        formatKr(toKroner(grundydelse2024Result), 2),
        rowOpts
      );
      if (showRest2024) {
        const restEetExpression = `${afgoerelse.eetPct} - ${formatPct(afgoerelse.kapPctAktuel)} = ${formatPct(afgoerelse.restEetPct)}`;
        const restTextPrefix =
          afgoerelse.kapitaliseringsdato !== null
            ? `Resterende EET (${restEetExpression}) efter kapitalisering ${formatISOToDanish(afgoerelse.kapitaliseringsdato as ISODateString)}`
            : 'Resterende EET efter kapitalisering';
        writer.writeLeftRightText(restTextPrefix, formatKr(toKroner(restGrundydelse2024), 2), rowOpts);
      }
    }
  }
};

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

type GenerateLoebendeYdelserDocumentParams = DocumentCommonOptions &
  Readonly<{
    computation: EetLoebendeComputation;
    visUdvidetSpecifikation?: boolean;
  }>;

export const generateLoebendeYdelserDocument = defineDocument<GenerateLoebendeYdelserDocumentParams>({
  title: 'Løbende ydelser (EET)',
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    'Løbende ydelser (EET)',
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, { computation, visUdvidetSpecifikation = false }) => {
    if (computation.afgoerelser.length === 0) {
      addLoebendeYdelserEmptyState(writer);
    } else {
      computation.afgoerelser.forEach((afgoerelse, index) => {
        addLoebendeAfgoerelseSection(writer, afgoerelse, computation, index === 0);
      });
    }
    if (visUdvidetSpecifikation) {
      addLoebendeUdvidetSpecifikationPage(writer, computation);
    }
  },
});
