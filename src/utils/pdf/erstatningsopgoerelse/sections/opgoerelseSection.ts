import { MARGINS, PDF_FONT_FAMILY, PDF_FONT_STYLES, type PdfFontFamily, type PdfFontStyle } from '../../pdfConfig';
import { ensureNonBreakingKr } from '../../pdfTextUtils';
import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from '../../../../domain/erstatningsopgoerelse/angivetLoenHelpers';
import {
  addOneDayIso,
  roundToFourDecimals,
} from '../../../../domain/erstatningsopgoerelse/sharedPdfUtils';
import type { Calculable, LoenudviklingSegment, MoneyOre, PdfModel } from '../../../../domain/erstatningsopgoerelse/eoPdfModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { roundByMethod } from '../../../../utils/rounding';

type OpgorelseSectionContext = Readonly<{
  model: PdfModel;
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  lineHeight: number;
  doubleLineHeight: number;
  afsluttesMed: 'Bekræftet godkendt' | 'Underskrift-linje';
  NBSP: string;
  rightColumnWidth: number;
  renderSectionHeader: (text: string, nextLineHeight: number) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  renderSubheaderWithWrappedText: (subheaderText: string, bodyText: string) => void;
  safeAddWrappedText: (text: string) => void;
  safeAddLeftRightText: (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
    }>
  ) => void;
  renderAtomicTableChunks: <T>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => void;
  assertModelInvariant: (condition: boolean, message: string) => void;
  renderMoneyWithKr: (value: Calculable<MoneyOre>) => string;
  renderMoneyWithKrTrimmed: (value: Calculable<MoneyOre>) => string;
  renderMoneyWithKrOrError: (value: Calculable<MoneyOre>) => string;
  formatMoneyOreWithKr: (ore: MoneyOre) => string;
  formatMoneyOreWithKrTrimmed: (ore: MoneyOre) => string;
  formatCurrencyFromOre: (ore: MoneyOre) => string;
  formatCurrencyFromOreTrimmed: (ore: MoneyOre) => string;
  formatCountWithUnit: (value: number, singular: string, plural: string) => string;
  formatMaanederTrimmed: (value: number) => string;
  isSingularCount: (value: number) => boolean;
  parseOptionalIsoDate: (value: string | undefined) => ISODateString | undefined;
  resolveLoenSkadesdatoText: (params: {
    subject: 'lønnen';
    skadesdato: ISODateString | undefined;
    saerligFraDatoRegulering: ISODateString | undefined;
  }) => string;
  formatDateShort: (dateIso: ISODateString | undefined) => string;
  formatDateLong: (isoDate: ISODateString | undefined) => string;
  formatPercentDelta: (value: number) => string;
  writer: Readonly<{
    addPage: () => void;
    addSpacer: (height: number) => void;
    advanceY: (height: number) => void;
    ensureSpace: (height: number) => void;
    getY: () => number;
    getTextWidth: (text: string) => number;
    setFont: (fontName: PdfFontFamily, fontStyle: PdfFontStyle) => void;
    writeUnderlinedLabel: (text: string, x: number) => void;
    writeSignatureBlock: (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => void;
  }>;
}>;

const resolveOevrigeKravYdelsesforbeholdLinje = (
  ydelser: readonly string[]
): string | null => {
  const hasKontanthjaelp = ydelser.includes('kontanthjaelp');
  const hasRessourceforloebsydelse = ydelser.includes('ressourceforloebsydelse');

  if (!hasKontanthjaelp && !hasRessourceforloebsydelse) return null;

  const hasBeggeYdelser = hasKontanthjaelp && hasRessourceforloebsydelse;
  const ydelseTekst = hasBeggeYdelser
    ? 'kontanthjælp og ressourceforløbsydelse'
    : hasKontanthjaelp
      ? 'kontanthjælp'
      : 'ressourceforløbsydelse';
  const tilbagebetalingsSubjekt = hasBeggeYdelser ? 'ydelserne' : 'ydelsen';

  return `Skadelidte har modtaget ${ydelseTekst} i erstatningsperioden. Kræves ${tilbagebetalingsSubjekt} tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.`;
};

const resolveOevrigeKravEetKlageReguleringsLinje = (
  eoValues: ErstatningsopgoerelseValues
): string | null => {
  if (eoValues.verserendeKlageEet !== 'Ja') return null;

  const harMidlertidigEetOplysning =
    eoValues.midlertidigtEetAfgorelse === 'Ja' &&
    (eoValues.midlertidigEETVirkningsdato !== undefined || eoValues.midlertidigEETAfgoerelseDato !== undefined);
  const harEndeligEetOplysning =
    eoValues.endeligtEetAfgorelse === 'Ja' &&
    (eoValues.endeligEETVirkningsdato !== undefined || eoValues.endeligEETAfgoerelseDato !== undefined);

  if (!harMidlertidigEetOplysning && !harEndeligEetOplysning) return null;

  return 'Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.';
};

const mergeLoenudviklingSegments = (segments: readonly LoenudviklingSegment[]): readonly LoenudviklingSegment[] => {
  if (segments.length <= 1) return segments;
  const merged: LoenudviklingSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(segment);
      continue;
    }

    const isAdjacent = addOneDayIso(last.til) === segment.fra;
    const isSameKind = last.kind === segment.kind;
    const isSameDelta = Math.abs(last.deltaPct - segment.deltaPct) < 0.00001;

    if (!isAdjacent || !isSameKind || !isSameDelta) {
      merged.push(segment);
      continue;
    }

    if (last.kind === 'arbejdsdage' && segment.kind === 'arbejdsdage' && last.dagsloenOre === segment.dagsloenOre) {
      merged[merged.length - 1] = {
        kind: 'arbejdsdage',
        fra: last.fra,
        til: segment.til,
        arbejdsdage: last.arbejdsdage + segment.arbejdsdage,
        dagsloenOre: last.dagsloenOre,
        deltaPct: last.deltaPct,
        amountOre: (last.amountOre + segment.amountOre) as MoneyOre,
      };
      continue;
    }

    if (last.kind === 'maaneder' && segment.kind === 'maaneder' && last.maanedsloenOre === segment.maanedsloenOre) {
      merged[merged.length - 1] = {
        kind: 'maaneder',
        fra: last.fra,
        til: segment.til,
        maaneder: roundToFourDecimals(last.maaneder + segment.maaneder),
        maanedsloenOre: last.maanedsloenOre,
        deltaPct: last.deltaPct,
        amountOre: (last.amountOre + segment.amountOre) as MoneyOre,
      };
      continue;
    }

    merged.push(segment);
  }
  return merged;
};

export const renderOpgorelseSection = (ctx: OpgorelseSectionContext): void => {
  const {
    model,
    eoValues,
    stamdataValues,
    lineHeight,
    doubleLineHeight,
    afsluttesMed,
    NBSP,
    rightColumnWidth,
    renderSectionHeader,
    renderSubheader,
    renderSubheaderWithWrappedText,
    safeAddWrappedText,
    safeAddLeftRightText,
    renderAtomicTableChunks,
    assertModelInvariant,
    renderMoneyWithKr,
    renderMoneyWithKrTrimmed,
    renderMoneyWithKrOrError,
    formatMoneyOreWithKr,
    formatMoneyOreWithKrTrimmed,
    formatCurrencyFromOre,
    formatCurrencyFromOreTrimmed,
    formatCountWithUnit,
    formatMaanederTrimmed,
    isSingularCount,
    parseOptionalIsoDate,
    resolveLoenSkadesdatoText,
    formatDateShort,
    formatDateLong,
    formatPercentDelta,
    writer,
  } = ctx;

  renderSectionHeader('Svie- og smertegodtgørelse', lineHeight);
  renderSubheader('Status', lineHeight, { addTopSpacing: false });
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);

  for (const line of model.svieSmerte.statusLinjer) {
    safeAddWrappedText(line);
  }

  renderSubheader(model.svieSmerte.periodeHeading, lineHeight);
  assertModelInvariant(
    model.svieSmerte.harPerioder === (model.svieSmerte.periodeLinjer.length > 0),
    'svieSmerte.harPerioder matcher ikke svieSmerte.periodeLinjer.'
  );
  if (!model.svieSmerte.harPerioder) {
    safeAddWrappedText('Ingen');
  } else if (!model.svieSmerte.beregnes) {
    safeAddWrappedText('Ingen');
  } else {
    for (const line of model.svieSmerte.periodeLinjer) {
      safeAddWrappedText(line);
    }

    renderSubheader('Beregningsgrundlag', lineHeight);
    const satserAar = model.svieSmerte.satserAar !== null ? String(model.svieSmerte.satserAar) : '-';
    safeAddWrappedText(`Beregningen af godtgørelse foretages ud fra satserne i år ${satserAar}.`);

    const perDagDisplayWithKr = renderMoneyWithKrTrimmed(model.svieSmerte.satserPerDag);
    const maxDisplayWithKr = renderMoneyWithKrTrimmed(model.svieSmerte.satserMax);
    if (model.svieSmerte.delvisFaktor !== 1 && model.svieSmerte.satserPerDag.status === 'ok') {
      const delvisSatsOre = Math.round(model.svieSmerte.satserPerDag.value * model.svieSmerte.delvisFaktor);
      const delvisSatsDisplayWithKr = formatMoneyOreWithKrTrimmed(delvisSatsOre);
      safeAddWrappedText(`Taksten udgør ${perDagDisplayWithKr} pr. sygedag og ${delvisSatsDisplayWithKr} pr. delvise sygedag, dog højst ${maxDisplayWithKr}`);
    } else {
      safeAddWrappedText(`Taksten udgør ${perDagDisplayWithKr} pr. sygedag, dog højst ${maxDisplayWithKr}`);
    }

    const tidligere = model.svieSmerte.tidligere;
    const aktuel = model.svieSmerte.aktuel;
    if (tidligere.status === 'ok' || aktuel.status === 'ok') {
      const tidligereDisplay = renderMoneyWithKrTrimmed(tidligere);
      const aktuelDisplay = renderMoneyWithKrTrimmed(aktuel);
      let tekst = '';
      if (tidligere.status === 'ok' && aktuel.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder samt modtaget ${aktuelDisplay} for denne periode.`;
      } else if (tidligere.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder.`;
      } else if (aktuel.status === 'ok') {
        tekst = `Der er tidligere modtaget ${aktuelDisplay} for denne periode.`;
      }
      if (tekst) {
        safeAddWrappedText(tekst);
      }
    }
    renderSubheader('Beregnet krav på svie- og smertegodtgørelse', lineHeight);
    const sygedage = model.svieSmerte.sygedage;
    const delviseSygedage = model.svieSmerte.delviseSygedage;
    const perDagOre = model.svieSmerte.satserPerDag.status === 'ok' ? model.svieSmerte.satserPerDag.value : null;
    const delvisOre = perDagOre !== null ? Math.round(perDagOre * model.svieSmerte.delvisFaktor) : null;

    const perDagText = perDagOre !== null ? formatCurrencyFromOreTrimmed(perDagOre) : '—';
    const delvisText = delvisOre !== null ? formatCurrencyFromOreTrimmed(delvisOre) : '—';
    const withKr = (value: string): string => (value === '—' ? value : `${value}${NBSP}kr.`);
    const perDagTextWithKr = withKr(perDagText);
    const delvisTextWithKr = withKr(delvisText);

    const lineLeft = (() => {
      if (sygedage === 0 && delviseSygedage === 0) return '—';
      if (perDagOre === null) return '—';

      let base = '';
      if (model.svieSmerte.delvisFaktor === 1) {
        const combined = [
          sygedage > 0 ? formatCountWithUnit(sygedage, 'sygedag', 'sygedage') : '',
          delviseSygedage > 0 ? formatCountWithUnit(delviseSygedage, 'delvis sygedag', 'delvise sygedage') : '',
        ].filter((part) => part !== '').join(' og ');
        const hasBoth = sygedage > 0 && delviseSygedage > 0;
        base = combined === '' ? '-' : `${combined}${hasBoth ? ',' : ''} ${hasBoth ? 'begge ' : ''}á ${perDagTextWithKr}`;
      } else {
        const parts: string[] = [];
        if (sygedage > 0) {
          parts.push(`${formatCountWithUnit(sygedage, 'sygedag', 'sygedage')} á ${perDagTextWithKr}`);
        }
        if (delviseSygedage > 0) {
          parts.push(`${formatCountWithUnit(delviseSygedage, 'delvis sygedag', 'delvise sygedage')} á ${delvisTextWithKr}`);
        }
        base = parts.join(' og ');
      }

      if (base === '' || base === '-') return '-';

      const deductions: string[] = [];
      if (aktuel.status === 'ok') {
        deductions.push(`-${NBSP}${formatMoneyOreWithKrTrimmed(aktuel.value)}`);
      }
      const maxSuffix = model.svieSmerte.maxApplied ? ' (reduceret til max)' : '';
      return `${base}${deductions.length > 0 ? ` ${deductions.join(' ')}` : ''}${maxSuffix} =`;
    })();

    const beloebDisplay = formatMoneyOreWithKr(model.svieSmerte.totalOre);
    safeAddLeftRightText(lineLeft, beloebDisplay, writer.getTextWidth('000.000.000,00'), { rightFontStyle: 'bold' });
  }

  renderSectionHeader('Tabt arbejdsfortjeneste', lineHeight);
  renderSubheader('Status', lineHeight, { addTopSpacing: false });
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);

  for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
    safeAddWrappedText(line);
  }

  for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
    safeAddWrappedText(line);
  }

  if (model.tabtArbejdsfortjeneste.differencekravLinje) {
    safeAddWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
  }

  const tafPeriodeHeader = model.tabtArbejdsfortjeneste.tafPerioderLinjer.length > 1
    ? 'Erstatningsperioder, hvor der beregnes tabt arbejdsfortjeneste'
    : 'Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste';
  renderSubheader(tafPeriodeHeader, lineHeight);

  const tafPerioderLines = model.tabtArbejdsfortjeneste.tafPerioderLinjer;
  const hasTafPerioder = model.tabtArbejdsfortjeneste.harTafPerioder;
  assertModelInvariant(hasTafPerioder === (tafPerioderLines.length > 0), 'harTafPerioder matcher ikke tafPerioderLinjer.');

  if (!hasTafPerioder) {
    safeAddWrappedText('Ingen');
  } else {
    for (const line of tafPerioderLines) {
      safeAddWrappedText(line);
    }

    renderSubheader('Indkomst på skadestidspunktet', lineHeight);
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    if (model.tabtArbejdsfortjeneste.skalKomprimereIndkomstBeregning && indkomst) {
      const erArbejdsdage = model.tabtArbejdsfortjeneste.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE;
      const loenLabel = erArbejdsdage ? 'Løn per arbejdsdag' : 'Månedsløn';
      const beloebDisplay = erArbejdsdage
        ? renderMoneyWithKr(indkomst.dagsloen)
        : renderMoneyWithKr(indkomst.maanedsloen);
      safeAddLeftRightText(
        `${loenLabel} er i tidligere erstatningsopgørelse beregnet til`,
        beloebDisplay,
        writer.getTextWidth('000.000.000,00'),
        { rightFontStyle: 'normal' }
      );
    } else {
      if (indkomst?.beregningsperiodeLabel) {
        safeAddWrappedText(indkomst.beregningsperiodeLabel);
      }
      const udskydMellemregningVedBeregningsperiode =
        indkomst?.beregnesUdFra === 'Beregningsperiode';
      if (!udskydMellemregningVedBeregningsperiode) {
        if (indkomst?.beregningsgrundlagMellemregningLabel && indkomst?.beregningsgrundlagMellemregningResultat) {
          safeAddLeftRightText(
            indkomst.beregningsgrundlagMellemregningLabel,
            indkomst.beregningsgrundlagMellemregningResultat,
            writer.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );
          writer.advanceY(lineHeight);
        } else if (indkomst?.beregningsgrundlagMellemregningLabel) {
          safeAddWrappedText(indkomst.beregningsgrundlagMellemregningLabel);
          writer.advanceY(lineHeight);
        } else if (indkomst?.beregningsgrundlagMellemregningResultat) {
          safeAddWrappedText(indkomst.beregningsgrundlagMellemregningResultat);
        }
      }

      if (indkomst?.beregnesUdFra === 'Beregningsperiode') {
        for (const arbejdssted of indkomst.arbejdssteder) {
          const componentRows: ReadonlyArray<Readonly<{ label: string; amountOre: number }>> = [
            {
              label: 'Ferieberettiget indkomst i beregningsperioden',
              amountOre: arbejdssted.breakdown.ferieberetOre,
            },
            {
              label: arbejdssted.fpLabel,
              amountOre: arbejdssted.breakdown.fpFvShSoOre,
            },
            {
              label: arbejdssted.pensionLabel,
              amountOre: arbejdssted.breakdown.pensionOre,
            },
            {
              label: 'Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg',
              amountOre: arbejdssted.breakdown.atpOre,
            },
          ];
          const visibleComponentRows = componentRows.filter((row) => row.amountOre !== 0);
          if (visibleComponentRows.length > 0) {
            writer.ensureSpace(lineHeight * 2);
          }

          writer.writeUnderlinedLabel(arbejdssted.navn, MARGINS.left);

          for (const row of visibleComponentRows) {
            safeAddLeftRightText(
              row.label,
              formatMoneyOreWithKr(row.amountOre),
              writer.getTextWidth('000.000.000,00'),
              { rightFontStyle: 'normal' }
            );
          }

          if (visibleComponentRows.length > 1) {
            safeAddLeftRightText('I alt:', formatMoneyOreWithKr(arbejdssted.breakdown.samletOre), writer.getTextWidth('000.000.000,00'),
              { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 }
            );
          }
          writer.advanceY(lineHeight);
        }
        if (indkomst.offentligeYdelser.length > 0) {
          if (indkomst.arbejdssteder.length === 0) {
            writer.advanceY(lineHeight);
          }
          writer.ensureSpace(lineHeight * 2);
          writer.writeUnderlinedLabel('Offentlige ydelser', MARGINS.left);
          for (const ydelse of indkomst.offentligeYdelser) {
            safeAddLeftRightText(
              ydelse.label,
              formatMoneyOreWithKr(ydelse.amountOre),
              writer.getTextWidth('000.000.000,00'),
              { rightFontStyle: 'normal' }
            );
          }
          if (indkomst.offentligeYdelser.length > 1) {
            safeAddLeftRightText(
              'I alt:',
              formatMoneyOreWithKr(indkomst.offentligeYdelserTotalOre),
              writer.getTextWidth('000.000.000,00'),
              { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 }
            );
          }
          writer.advanceY(lineHeight);
        }

        if (indkomst.samletBeregningsgrundlagOre !== null) {
          const addends = indkomst.arbejdssteder.map((arbejdssted) =>
            formatCurrencyFromOre(arbejdssted.breakdown.samletOre)
          );
          if (indkomst.offentligeYdelserTotalOre > 0) {
            addends.push(formatCurrencyFromOre(indkomst.offentligeYdelserTotalOre));
          }
          if (udskydMellemregningVedBeregningsperiode) {
            if (indkomst.beregningsgrundlagMellemregningLabel && indkomst.beregningsgrundlagMellemregningResultat) {
              safeAddLeftRightText(
                indkomst.beregningsgrundlagMellemregningLabel,
                indkomst.beregningsgrundlagMellemregningResultat,
                writer.getTextWidth('000.000.000,00'),
                { rightFontStyle: 'normal' }
              );
            } else if (indkomst.beregningsgrundlagMellemregningLabel) {
              safeAddWrappedText(indkomst.beregningsgrundlagMellemregningLabel);
            } else if (indkomst.beregningsgrundlagMellemregningResultat) {
              safeAddWrappedText(indkomst.beregningsgrundlagMellemregningResultat);
            }
          }
          if (indkomst.beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE && indkomst.arbejdsdage) {
            const arbejdsdageText = formatCountWithUnit(indkomst.arbejdsdage, 'arbejdsdag', 'arbejdsdage');
            const basisText = addends.length > 1
              ? `Dagsløn: (${addends.join(' + ')}${NBSP}kr.) / ${arbejdsdageText} =`
              : `Dagsløn: ${formatMoneyOreWithKr(indkomst.samletBeregningsgrundlagOre)} / ${arbejdsdageText} =`;
            safeAddLeftRightText(
              basisText,
              renderMoneyWithKr(indkomst.dagsloen),
              writer.getTextWidth('000.000.000,00'),
              { rightFontStyle: 'normal' }
            );
          } else if (indkomst.maaneder) {
            const maanederText = formatMaanederTrimmed(indkomst.maaneder);
            const maanederMedEnhed = `${maanederText} ${isSingularCount(indkomst.maaneder) ? 'måned' : 'måneder'}`;
            const basisText = addends.length > 1
              ? `Månedsløn: (${addends.join(' + ')}${NBSP}kr.) / ${maanederMedEnhed} =`
              : `Månedsløn: ${formatMoneyOreWithKr(indkomst.samletBeregningsgrundlagOre)} / ${maanederMedEnhed} =`;
            safeAddLeftRightText(
              basisText,
              renderMoneyWithKr(indkomst.maanedsloen),
              writer.getTextWidth('000.000.000,00'),
              { rightFontStyle: 'normal' }
            );
          }
        }
      } else if (indkomst?.beregnesUdFra === 'Angivet månedsløn') {
        const venstreTekst = indkomst.loenBaseretPaa
          ? `På baggrund af ${indkomst.loenBaseretPaa} lægges en månedsløn til grund på`
          : 'Der lægges en månedsløn til grund på';
        safeAddLeftRightText(
          venstreTekst,
          renderMoneyWithKrOrError(indkomst.maanedsloen),
          writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );
      } else if (indkomst?.beregnesUdFra === 'Angivet dagsløn') {
        const venstreTekst = indkomst.loenBaseretPaa
          ? `På baggrund af ${indkomst.loenBaseretPaa} lægges en dagsløn til grund på`
          : 'Der lægges en dagsløn til grund på';
        safeAddLeftRightText(
          venstreTekst,
          renderMoneyWithKrOrError(indkomst.dagsloen),
          writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );
      }
    }

    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    const saerligFraDatoLoenudvikling = (() => {
      const ansaettelser = resolveLoenudviklingKilde(eoValues);
      const active = ansaettelser.filter(
        (af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen'
      );
      if (active.length === 0) return undefined;
      return parseOptionalIsoDate(active[0].saerligFraDatoRegulering);
    })();
    const skadesdatoIso = parseOptionalIsoDate(stamdataValues.skadesdato);
    const loenSkadesdatoText = resolveLoenSkadesdatoText({
      subject: 'lønnen',
      skadesdato: skadesdatoIso,
      saerligFraDatoRegulering: saerligFraDatoLoenudvikling,
    });
    const angivetLoenOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(eoValues);
    const angivetLoenDatoBeskrivelse = (() => {
      if (
        (eoValues.beregnesUdFra !== 'Angivet månedsløn' && eoValues.beregnesUdFra !== 'Angivet dagsløn') ||
        !angivetLoenOpreguleresFraDato
      ) {
        return null;
      }
      const datoDisplay = formatDateLong(angivetLoenOpreguleresFraDato);
      if (!datoDisplay) return null;
      return `lønnen opgjort den ${datoDisplay}`;
    })();
    const loenReferenceBeskrivelse = angivetLoenDatoBeskrivelse ?? loenSkadesdatoText;
    const indkomstHvisSkadeIkkeIndtraadtBeskrivelse = loenudvikling?.loenudviklingLabel === 'Ingen'
      ? `Opgøres på baggrund af ${loenReferenceBeskrivelse}.`
      : `Beregnes som ${loenReferenceBeskrivelse} tillagt efterfølgende lønstigninger.`;
    renderSubheaderWithWrappedText(
      'Indkomst, hvis skaden ikke var indtrådt',
      indkomstHvisSkadeIkkeIndtraadtBeskrivelse
    );

    if (loenudvikling) {
      writer.addSpacer(lineHeight);
      const renderLoenudviklingSegments = (
        segments: readonly LoenudviklingSegment[],
        total: Calculable<MoneyOre>,
        forceTotalLine: boolean
      ) => {
        if (total.status !== 'ok') {
          safeAddWrappedText('Lønudvikling kan ikke beregnes for den valgte opsætning.');
          return;
        }
        const rightMaxWidth = writer.getTextWidth('000.000.000,00');
        const segmentsForDisplay = mergeLoenudviklingSegments(segments);
        for (const segment of segmentsForDisplay) {
          const roundedDeltaPct = roundByMethod(segment.deltaPct, 2, 'halfAwayFromZero');
          const factorText = Math.abs(roundedDeltaPct) < 0.00001
            ? ''
            : ` x (100 % ${roundedDeltaPct >= 0 ? '+' : '-'} ${formatPercentDelta(roundedDeltaPct)} %)`;
          const fraDisplay = formatDateShort(segment.fra);
          const tilDisplay = formatDateShort(segment.til);
          let leftText = '';
          if (segment.kind === 'arbejdsdage') {
            const arbejdsdageText = formatCountWithUnit(segment.arbejdsdage, 'arbejdsdag', 'arbejdsdage');
            const dagsloenText = formatCurrencyFromOre(segment.dagsloenOre);
            leftText = `${fraDisplay} - ${tilDisplay}: ${arbejdsdageText} á ${dagsloenText}${NBSP}kr.${factorText} =`;
          } else {
            const roundedMaaneder = roundByMethod(segment.maaneder, 4, 'halfAwayFromZero');
            const maanederText = formatMaanederTrimmed(roundedMaaneder);
            const maanedsloenText = formatCurrencyFromOre(segment.maanedsloenOre);
            leftText = `${fraDisplay} - ${tilDisplay}: ${maanederText} ${isSingularCount(roundedMaaneder) ? 'måned' : 'måneder'} á ${maanedsloenText}${NBSP}kr.${factorText} =`;
          }
          const rightText = formatMoneyOreWithKr(segment.amountOre);
          safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
        }
        if ((segmentsForDisplay.length > 1 || forceTotalLine) && total.status === 'ok') {
          safeAddLeftRightText(
            'I alt',
            formatMoneyOreWithKr(total.value),
            rightMaxWidth,
            { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 }
          );
        }
      };

      const harPerAnsaettelse = loenudvikling.perAnsaettelse.length > 1;
      if (harPerAnsaettelse) {
        for (const entry of loenudvikling.perAnsaettelse) {
          writer.addSpacer(lineHeight);
          writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
          writer.writeUnderlinedLabel(entry.ansaettelsesforholdNavn, MARGINS.left);
          renderLoenudviklingSegments(entry.beregnedeSegmenter, entry.loenudviklingTotal, true);
        }
        if (loenudvikling.loenudviklingTotal.status === 'ok') {
          writer.addSpacer(lineHeight);
          const rightMaxWidth = writer.getTextWidth('000.000.000,00');
          safeAddLeftRightText(
            'I alt',
            formatMoneyOreWithKr(loenudvikling.loenudviklingTotal.value),
            rightMaxWidth,
            { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 }
          );
        }
      } else {
        renderLoenudviklingSegments(loenudvikling.beregnedeSegmenter, loenudvikling.loenudviklingTotal, false);
      }
    }

    const tafIndtaegter = model.tabtArbejdsfortjeneste.tafIndtaegter;
    if (tafIndtaegter) {
      assertModelInvariant(
        tafIndtaegter.total.status === 'ok' || tafIndtaegter.total.status === 'not_calculable',
        'tafIndtaegter.total har en uventet status.'
      );
      renderSubheader('Indtægter i erstatningsperioden', lineHeight);
      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      for (const entry of tafIndtaegter.entries) {
        safeAddLeftRightText(entry.label, formatMoneyOreWithKr(entry.amountOre), rightMaxWidth, { rightFontStyle: 'normal' });
      }

      if (tafIndtaegter.entries.length === 0) {
        safeAddWrappedText('Ingen');
      } else if (tafIndtaegter.entries.length > 1 && tafIndtaegter.total.status === 'ok') {
        safeAddLeftRightText('I alt', formatMoneyOreWithKr(tafIndtaegter.total.value), rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 });
      } else if (tafIndtaegter.entries.length > 1) {
        safeAddLeftRightText('I alt', '—', rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 });
      }
    }

    const loenudviklingTotal = model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal ?? null;
    const tafTotal = model.tabtArbejdsfortjeneste.tafIndtaegter?.total ?? null;
    const tidligereModtagetTaf = model.tabtArbejdsfortjeneste.tidligereModtagetTaf;
    if (tidligereModtagetTaf.status === 'ok') {
      renderSubheader('Tidligere betalt erstatning', lineHeight);
      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      safeAddLeftRightText(
        'Der er allerede betalt tabt arbejdsfortjeneste for perioden med',
        formatMoneyOreWithKr(tidligereModtagetTaf.value),
        rightMaxWidth,
        { rightFontStyle: 'normal' }
      );
    }

    if (loenudviklingTotal && tafTotal && loenudviklingTotal.status === 'ok' && tafTotal.status === 'ok') {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);

      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      const loenudviklingUdenKr = formatCurrencyFromOre(loenudviklingTotal.value);
      const tafUdenKr = formatCurrencyFromOre(tafTotal.value);
      const ledFoerLigmed = [loenudviklingUdenKr, tafUdenKr];
      if (tidligereModtagetTaf.status === 'ok') {
        ledFoerLigmed.push(formatCurrencyFromOre(tidligereModtagetTaf.value));
      }
      const leftText = `${ledFoerLigmed
        .map((led, index) => (index === ledFoerLigmed.length - 1 ? `${led}${NBSP}kr.` : led))
        .join(' - ')} =`;
      const rightText = formatMoneyOreWithKr(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
      safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'bold' });
    } else if (model.tabtArbejdsfortjeneste.harTafPerioder) {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);
      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      safeAddLeftRightText('Beregnet krav på tabt arbejdsfortjeneste', '—', rightMaxWidth, { rightFontStyle: 'bold' });
    }
  }

  const kravEntries = model.oevrigeKrav.entries;
  const kravRightMaxWidth = writer.getTextWidth('000.000.000,00');
  const kravHeaderHeight = lineHeight * 4;
  const oevrigeKravYdelsesforbeholdLinje = resolveOevrigeKravYdelsesforbeholdLinje(
    model.tabtArbejdsfortjeneste.tafIndtaegter?.oevrigeKravForbeholdYdelsestyper ?? []
  );
  // Intentionel kobling: EET-klage-reguleringslinjen vises kun når der allerede er en
  // ydelsesforbehold-linje (kontanthjælp/ressourceforløbsydelse), fordi de to linjer
  // hører samen som én samlet forbehold-blok. En sag med verserende EET-klage men
  // uden disse ydelser får ikke linjen — det er korrekt adfærd.
  const oevrigeKravEetKlageReguleringsLinje = oevrigeKravYdelsesforbeholdLinje
    ? resolveOevrigeKravEetKlageReguleringsLinje(eoValues)
    : null;
  const oevrigeKravIntroLinjer = [oevrigeKravYdelsesforbeholdLinje, oevrigeKravEetKlageReguleringsLinje].filter(
    (line): line is string => line !== null
  );
  const renderOevrigeKravIntro = (addTrailingSpacer: boolean): void => {
    oevrigeKravIntroLinjer.forEach((line, index) => {
      safeAddWrappedText(line);
      const erSidsteLinje = index === oevrigeKravIntroLinjer.length - 1;
      if (!erSidsteLinje || addTrailingSpacer) {
        writer.addSpacer(lineHeight);
      }
    });
  };

  if (kravEntries.length === 0) {
    renderSectionHeader('Øvrige krav', lineHeight);
    if (oevrigeKravIntroLinjer.length > 0) {
      renderOevrigeKravIntro(false);
    } else {
      safeAddWrappedText('Ingen');
    }
  } else {
    renderAtomicTableChunks({
      rows: kravEntries,
      estimateRowHeight: lineHeight * 2,
      headerHeight: kravHeaderHeight,
      renderHeader: () => {
        renderSectionHeader('Øvrige krav', lineHeight);
        if (oevrigeKravIntroLinjer.length > 0) {
          renderOevrigeKravIntro(true);
        }
      },
      renderRow: (entry) => {
        const udgiftText = entry.udgiftTil !== '' ? entry.udgiftTil : '-';
        const leftLabel = entry.dateText !== '' ? `${entry.dateText}: ${udgiftText}` : udgiftText;
        const amountText = formatMoneyOreWithKr(entry.amountOre);
        safeAddLeftRightText(ensureNonBreakingKr(leftLabel), amountText, kravRightMaxWidth, { rightFontStyle: kravEntries.length === 1 ? 'bold' : 'normal' });
      },
    });

    if (kravEntries.length > 1) {
      writer.addSpacer(lineHeight * 2);
      safeAddLeftRightText('I alt', formatMoneyOreWithKr(model.oevrigeKrav.totalOre), kravRightMaxWidth, { rightFontStyle: 'bold', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 });
    }
  }
  renderSectionHeader('Samlet erstatningskrav', lineHeight);

  const periodeFraKort = model.periode?.fra ? formatDateShort(model.periode.fra) : '';
  const periodeTilKort = model.periode?.til ? formatDateShort(model.periode.til) : '';
  const periodeText =
    periodeFraKort && periodeTilKort
      ? `Det samlede krav for perioden ${periodeFraKort} - ${periodeTilKort} udgør:`
      : 'Det samlede krav udgør:';
  safeAddWrappedText(periodeText);
  writer.advanceY(lineHeight);

  const summaryRightMaxWidth = writer.getTextWidth('000.000.000,00');
  safeAddLeftRightText('Svie- og smertegodtgørelse', formatMoneyOreWithKr(model.samlet.svieSmerteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  safeAddLeftRightText('Tabt arbejdsfortjeneste', formatMoneyOreWithKr(model.samlet.tabtArbejdsfortjenesteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  safeAddLeftRightText('Øvrige krav', formatMoneyOreWithKr(model.samlet.oevrigeKravOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  safeAddLeftRightText('Erstatningskrav i alt', formatMoneyOreWithKr(model.samlet.totalOre), summaryRightMaxWidth, { rightFontStyle: 'bold', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 });
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  const saerligeKommentarer = model.saerligeKommentarer;
  if (saerligeKommentarer) {
    renderSectionHeader('Særlige bemærkninger', lineHeight);
    safeAddWrappedText(saerligeKommentarer);
  }
  writer.advanceY(doubleLineHeight);
  if (afsluttesMed === 'Bekræftet godkendt') {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som har bekræftet, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevante oplysninger, som skadelidte er bekendt med.');
  } else {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som ved sin underskrift nedenfor bekræfter, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevante oplysninger, som skadelidte er bekendt med.');
    writer.advanceY(lineHeight * 2);
    const skadelidteNavn = (stamdataValues.skadelidte ?? '').trim() || '*skadelidtes navn*';
    const dateX = MARGINS.left;
    const dateLine = '____ / ____ - ____________';
    const sigX = MARGINS.left + 90;
    const sigLine = '________________________________________';
    const signatureBlockHeight = lineHeight * 2;
    writer.ensureSpace(signatureBlockHeight);
    writer.writeSignatureBlock(dateLine, sigLine, dateX, sigX, skadelidteNavn);
  }
};
