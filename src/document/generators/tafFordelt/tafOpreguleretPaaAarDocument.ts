/**
 * PDF Generator for TAF opreguleret til beregningsåret
 *
 * Viser tabt arbejdsfortjeneste opbygget i samme stil som den almindelige
 * erstatningsopgørelse-PDF, men hvor TAF-kravet beregnes individuelt for hvert
 * kalenderår og dernæst opreguleres til beregningsårets prisniveau. De opregulerede
 * årsbeløb summeres til sidst til ét samlet krav.
 *
 * Fælles top (Status, Erstatningsperiode, Beregningsgrundlag, Forventet indkomst-
 * introtekst) vises én gang. Herefter ét afsnit pr. kalenderår med understregede
 * underafsnit (Forventet indkomst, Indtægter i erstatningsperioden, Beregnet krav,
 * Opreguleret til beregningsåret). Til sidst medtages præcis de samme bilag som i den
 * almindelige erstatningsopgørelse-PDF (gated på de samme valgte elementer).
 *
 * Opreguleringen følger den akkumulerede reguleringssats ("tilpasningsprocenten
 * plus to procent") – samme metode som fremskrivning af årsløn til EET efter EAL
 * og regulering af offentlige ydelser.
 *
 * Dokumentet genererer kun fra et præ-projiceret snapshot-dokument.
 * Eventuel fail-closed / blokering er allerede afgjort før denne generator kaldes.
 */

import { defineDocument } from '../documentGeneratorSetup';
import type { DocumentLabelValueOptions } from '../../model/documentModel';
import { ensureNonBreakingKr } from '../../layout/pdfTextUtils';
import { PDF_BASE_LINE_HEIGHT_MM, PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM } from '../../layout/pdfConfig';
import { logWarning } from '../../../utils/logger';
import { formatIsoDateLong as formatDateLong, formatISOToDanish as formatDateShort } from '../../../utils/dateFormatting';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatReguleringFactorText,
  isSingularCount,
  resolveDocumentArtifactFileName,
} from '../../layout/documentFormatUtils';
import { TAF_OPREGULERET_DELTA_PCT_DECIMALS } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import type { Calculable } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { MoneyOre } from '../../../domain/money/money';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { DocumentGenerationSession } from '../../documentGenerationSession';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import type { SelectedElements } from '../eo/types';
import { renderEoBilagSections } from '../eo/sections/eoBilagSections';
import {
  renderTafBeregningsgrundlag,
  resolveTafForventetIndkomstIntroText,
} from '../eo/sections/tafBeregningsgrundlagSection';
import type { TafPerYearOpreguleretDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument';

const NBSP = '\u00A0';
const FILE_BASE_NAME = 'TAF opreguleret til beregningsår';
const TAF_RIGHT_COLUMN_WIDTH = PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM;

// NOTE: Årsbeløb må være negative; PDF viser de beregnede værdier direkte.

interface TafOpreguleretPaaAarDocumentOptions {
  document: TafPerYearOpreguleretDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
  /** Valgfri – kræves kun for at medtage bilag (samme som den almindelige EO-PDF). */
  eoValues?: ErstatningsopgoerelseValues;
  stamdataValues?: StamdataValues;
  selectedElements?: SelectedElements;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
}

export const generateTafOpreguleretPaaAarDocument = (
  session: DocumentGenerationSession,
  options: TafOpreguleretPaaAarDocumentOptions
) => {
  const { visBrevhoved = false, visUdkastStempel = false } = options;
  const { model, presentation, opreguleret } = options.document;
  const { eoValues, stamdataValues, selectedElements, midlertidigtEetGroups } = options;

  const titel = 'TAF opreguleret til beregningsår';

  const generate = defineDocument<void>({
    title: titel,
    filename: (_input, format) => resolveDocumentArtifactFileName(
      FILE_BASE_NAME,
      visUdkastStempel,
      model.brevhoved?.journalnr,
      format
    ),
    writerOptions: {
      onLayoutFallback: ({ message, label }) => {
        logWarning('PDF-layout fallback aktiveret', {
          context: 'pdf.tafOpreguleretPaaAar.layout',
          data: { message, label },
        });
      },
    },
    beforeBrevhoved: (writer) => {
      if (visUdkastStempel) writer.addUdkastWatermark();
    },
    brevhoved: () => visBrevhoved && model.brevhoved
      ? {
        journalnr: model.brevhoved.journalnr,
        advokat: model.brevhoved.advokat,
        sagsbehandler: model.brevhoved.sagsbehandler,
        dagsDatoISO: model.brevhoved.dagsDatoISO,
      }
      : null,
    titleOptions: { trailingSpacing: 0 },
    body: (writer) => {
  const lineHeight = PDF_BASE_LINE_HEIGHT_MM;
  const rightMaxWidth = 0;

  // Lokale tekst-hjælpere på linje med den almindelige EO-PDF (samme signatur).
  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    minRightWidth: number,
    options?: DocumentLabelValueOptions
  ) => {
    writer.writeLeftRightText(leftText, rightText, {
      ...options,
      minRightColumnWidth: Math.max(minRightWidth, TAF_RIGHT_COLUMN_WIDTH),
      minRightColumnWidthText: '000.000.000,00',
    });
  };
  // Beregningsgrundlag-lønnen er gated fail-closed i snapshot-projektionen
  // (tafBeregningsgrundlagAngivetLoenMangler) – den er altid 'ok', når vi når hertil.
  // Skulle den mod forventning ikke være det, kaster vi (systemfejl routes via A5) frem for
  // at udskrive en teknisk fejlkode i et tillidskritisk dokument.
  const renderMoneyWithKrOrError = (value: Calculable<MoneyOre>): string => {
    if (value.status !== 'ok') {
      throw new Error(`Beregningsgrundlag-løn ikke beregnelig ved dokument-rendering: ${value.reason}`);
    }
    return `${formatCurrencyFromOre(value.value)}${NBSP}kr.`;
  };

  // Erstatningsperiode
  if (model.periodeDisplay) {
    writer.writeWrappedText(model.periodeDisplay);
    writer.addSectionSpacer();
  }

  // Skadelidtes navn (fed)
  if (model.skadelidteNavn) {
    writer.writeBoldWrappedText(model.skadelidteNavn);
  }

  // Skadestype (normal)
  if (model.skadestypeLinje) {
    writer.writeWrappedText(model.skadestypeLinje);
    writer.addSectionSpacer();
  }

  // ─── Tabt arbejdsfortjeneste sektion (fælles top) ─────────────────────

  writer.writeSectionHeader('Tabt arbejdsfortjeneste');

  writer.writeBoldSubheaderIfContent({
    text: 'Status',
    hasContent:
      model.tabtArbejdsfortjeneste.statusLinjer.length > 0 ||
      model.tabtArbejdsfortjeneste.eetLinjer.length > 0 ||
      model.tabtArbejdsfortjeneste.differencekravLinje !== null,
    renderContent: () => {
      for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
        writer.writeWrappedText(line);
      }
      if (model.tabtArbejdsfortjeneste.differencekravLinje) {
        writer.writeWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
      }
      for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
        writer.writeWrappedText(line);
      }
    },
  });

  // TAF-perioder
  const tafPeriodeHeader = model.tabtArbejdsfortjeneste.tafPerioderLinjer.length > 1
    ? 'Erstatningsperioder med tabt arbejdsfortjeneste'
    : 'Erstatningsperiode med tabt arbejdsfortjeneste';
  writer.writeBoldSubheader(tafPeriodeHeader);
  if (!model.tabtArbejdsfortjeneste.harTafPerioder) {
    writer.writeWrappedText('Ingen');
    writer.writeBoldSubheader('TAF opreguleret til beregningsåret');
    writer.writeWrappedText('Ingen');
    return;
  }
  for (const line of model.tabtArbejdsfortjeneste.tafPerioderLinjer) {
    writer.writeWrappedText(line);
  }

  if (model.forlig.erIndgaaet) {
    writer.writeBoldSubheader('Forlig');
    const forligDatoTekst = model.forlig.dato ? `den ${formatDateLong(model.forlig.dato)}` : null;
    const forligTekst = forligDatoTekst
      ? `Der er ${forligDatoTekst} indgået forlig i sagen på betaling af ${model.forlig.label}.`
      : `Der er indgået forlig i sagen på betaling af ${model.forlig.label}.`;
    writer.writeWrappedText(forligTekst);
  }

  if (!presentation || !opreguleret) {
    writer.writeBoldSubheader('TAF opreguleret til beregningsåret');
    writer.writeWrappedText('TAF opreguleret til beregningsåret kan ikke beregnes for den valgte opsætning.');
    return;
  }

  // Beregningsgrundlag (dagsløn/månedsløn ved skadestidspunktet) – fælles for alle år.
  renderTafBeregningsgrundlag({
    model,
    renderMoneyWithKrOrError,
    lineHeight,
    rightColumnWidth: TAF_RIGHT_COLUMN_WIDTH,
    rightMaxWidth,
    renderSubheader: writer.writeBoldSubheader,
    safeAddWrappedText: writer.writeWrappedText,
    safeAddLeftRightText,
    writer,
  });

  // Forventet indkomst-introtekst – fælles for alle år (kan kun beregnes med rå-input).
  if (eoValues && stamdataValues) {
    const introTekst = resolveTafForventetIndkomstIntroText({
      model,
      eoValues,
      stamdataValues,
    });
    // Løn- og offentlige-ydelser-sætningerne (adskilt af \n) skrives som separate afsnit,
    // så de får samme normale afsnits-linjeafstand (B5.2) som ferie-/fravær-linjen nedenfor –
    // ens med EO-opgørelsens "Forventet indkomst".
    writer.writeBoldSubheader('Forventet indkomst');
    for (const afsnit of introTekst.split('\n')) {
      writer.writeWrappedText(afsnit);
    }
    if (model.tabtArbejdsfortjeneste.ferieFravaerLinje) {
      writer.writeWrappedText(model.tabtArbejdsfortjeneste.ferieFravaerLinje);
    }
  }

  const beregningsAar = opreguleret.beregningsAar;
  const opreguleretByYear = new Map(opreguleret.years.map((entry) => [entry.year, entry] as const));

  // ─── Beregning pr. kalenderår ─────────────────────────────────────────

  for (const yearEntry of presentation.years) {
    writer.writeSectionHeader(`${yearEntry.year}`);

    // Forventet indkomst (årets løn-/ydelsessegmenter).
    writer.writeUnderlinedSubheader('Forventet indkomst');
    if (yearEntry.segments.length === 0) {
      writer.writeWrappedText('Ingen');
    }
    for (const segment of yearEntry.segments) {
      // KL-lønaftaler: enhedsløn vises som den allerede regulerede løn uden faktor-tekst.
      // Se docs/domain/taf/kl-loenaftaler-regulering.md.
      const erReguleretLoen = segment.reguleretLoenOre !== undefined;
      const factorText = erReguleretLoen ? '' : formatReguleringFactorText(segment.deltaPct);
      let leftText = '';
      if (segment.kind === 'arbejdsdage') {
        const arbejdsdageText = formatCountWithUnit(segment.quantity, 'arbejdsdag', 'arbejdsdage');
        const dagsloenText = formatCurrencyFromOre(segment.reguleretLoenOre ?? segment.unitAmountOre);
        leftText = `${formatDateShort(segment.fra)} - ${formatDateShort(segment.til)}: ${arbejdsdageText} á ${dagsloenText}${NBSP}kr.${factorText} =`;
      } else {
        const maanederText = `${formatMaanederTrimmed(segment.quantity)} ${isSingularCount(segment.quantity) ? 'måned' : 'måneder'}`;
        const maanedsloenText = formatCurrencyFromOre(segment.reguleretLoenOre ?? segment.unitAmountOre);
        leftText = `${formatDateShort(segment.fra)} - ${formatDateShort(segment.til)}: ${maanederText} á ${maanedsloenText}${NBSP}kr.${factorText} =`;
      }
      const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(segment.amountOre));
      safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
    }
    if (yearEntry.segments.length > 1) {
      const indkomstIAltText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearIncomeOre));
      safeAddLeftRightText('I alt', indkomstIAltText, rightMaxWidth, {
        rightFontStyle: 'normal',
        separatorAboveValue: { widthMm: TAF_RIGHT_COLUMN_WIDTH, gapMm: 4 },
      });
    }

    // Indtægter i erstatningsperioden (årets fradrag).
    writer.writeUnderlinedSubheader('Indtægter i erstatningsperioden');
    if (yearEntry.deductions.length === 0) {
      writer.writeWrappedText('Ingen');
    }
    for (const deduction of yearEntry.deductions) {
      const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(deduction.amountOre));
      safeAddLeftRightText(deduction.label, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
    }
    if (yearEntry.deductions.length > 1) {
      const fradragIAltText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearDeductionsOre));
      safeAddLeftRightText('I alt', fradragIAltText, rightMaxWidth, {
        rightFontStyle: 'normal',
        separatorAboveValue: { widthMm: TAF_RIGHT_COLUMN_WIDTH, gapMm: 4 },
      });
    }

    // Beregnet krav for året (fuld udregningslinje, som i den almindelige EO-PDF).
    // Indtægterne i erstatningsperioden indgår som ÉN sammentalt fradragsværdi (svarende til
    // "I alt"-linjen ovenfor) – ikke som separate fradrags-led pr. post. Ensartet med den
    // almindelige erstatningsopgørelse (renderOpgorelseSection, "Beregnet krav"), hvor kun
    // forventet-indkomst-totalen og indtægts-totalen vises. Fradraget udelades helt når summen
    // er 0, så et "- 0,00"-led aldrig optræder.
    writer.writeUnderlinedSubheader('Beregnet krav');
    const positiveLed = formatCurrencyFromOre(yearEntry.yearIncomeOre);
    const expressionText = yearEntry.yearDeductionsOre !== 0
      ? `${positiveLed} - ${formatCurrencyFromOre(yearEntry.yearDeductionsOre)}${NBSP}kr.`
      : `${positiveLed}${NBSP}kr.`;
    // "Allerede betalt TAF" trækkes fra UDEN FOR forlig-faktoren (som i hovedopgørelsen), så
    // ligningen giver netop yearTafOre. Tidligere lå beløbet fejlagtigt blandt de forlig-skalerede
    // fradrag, hvilket gjorde ligningen aritmetisk falsk ved forlig + allerede betalt TAF.
    const tidligereSuffix = yearEntry.yearTidligereModtagetTafOre > 0
      ? ` - ${formatMoneyOreWithKr(yearEntry.yearTidligereModtagetTafOre)}`
      : '';
    const beregnetKravLeftText = model.forlig.erIndgaaet
      ? `${model.forlig.label} x (${expressionText})${tidligereSuffix} =`
      : `${expressionText}${tidligereSuffix} =`;
    const beregnetKravRightText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearTafOre));
    safeAddLeftRightText(beregnetKravLeftText, beregnetKravRightText, rightMaxWidth, { rightFontStyle: 'normal' });

    // Opregulering til beregningsåret.
    const opreguleretEntry = opreguleretByYear.get(yearEntry.year);
    if (opreguleretEntry) {
      writer.writeUnderlinedSubheader('Opreguleret til beregningsåret');
      // factorText har formen " x (100 % + 16,0800 %)"; her ønskes "-værdi (100 % + 16,0800 %)"
      // uden multiplikations-tegnet, så " x " strippes for netop denne linje.
      const factorText = formatReguleringFactorText(
        opreguleretEntry.deltaPct,
        TAF_OPREGULERET_DELTA_PCT_DECIMALS
      ).replace(/^ x /, ' ');
      const opreguleretLeftText = `Opreguleret til ${beregningsAar}-værdi${factorText} =`;
      const opreguleretRightText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleretEntry.yearTafOpreguleretOre));
      safeAddLeftRightText(opreguleretLeftText, opreguleretRightText, rightMaxWidth, { rightFontStyle: 'bold' });
    }
  }

  // ─── Samlet ──────────────────────────────────────────────────────────

  writer.writeSectionHeader('Samlet');

  // Per-år linjer (opregulerede beløb)
  for (const opreguleretEntry of opreguleret.years) {
    const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleretEntry.yearTafOpreguleretOre));
    safeAddLeftRightText(`${opreguleretEntry.year}`, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
  }

  // Samlet opreguleret TAF-krav (fed, med streg)
  const samletText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleret.sumOpreguleretOre));
  safeAddLeftRightText(`Samlet TAF opreguleret til ${beregningsAar}`, samletText, rightMaxWidth, {
    rightFontStyle: 'bold',
    separatorAboveValue: { widthMm: TAF_RIGHT_COLUMN_WIDTH, gapMm: 4 },
  });

  // ─── Bilag (samme som den almindelige erstatningsopgørelse-PDF) ───────

  if (eoValues && stamdataValues && selectedElements) {
    renderEoBilagSections({
      writer,
      model,
      eoValues,
      stamdataValues,
      selectedElements,
      midlertidigtEetGroups,
    });
  }

    },
  });
  return generate(session, undefined);
};
