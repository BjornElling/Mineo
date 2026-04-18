import { MARGINS } from '../../../infrastructure/pdfConfig';
import { ensureNonBreakingKr } from '../../../shared/pdfTextUtils';
import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { resolveLoenudviklingKilde } from '../../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../../../../domain/erstatningsopgoerelse/pdf/eoPdfRegulering';
import {
  getDayAfterIso,
} from '../../../../domain/erstatningsopgoerelse/pdf/sharedPdfUtils';
import { round4 as roundToFourDecimals } from '../../../../utils/roundingShortcuts';
import { resolveOevrigeKravIntroLinjer } from '../../../../domain/erstatningsopgoerelse/helpers/oevrigeKravIntro';
import { resolveBilagWarning } from '../../../../domain/erstatningsopgoerelse/helpers/bilagWarnings';
import type { Calculable, LoenudviklingSegment, MoneyOre, EoModel } from '../../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { roundByMethod } from '../../../../utils/rounding';

type OpgorelseSectionContext = Readonly<{
  model: EoModel;
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  lineHeight: number;
  doubleLineHeight: number;
  afsluttesMed: 'Bekræftet godkendt' | 'Underskrift-linje';
  NBSP: string;
  rightColumnWidth: number;
  renderSectionHeader: (text: string, nextLineHeight: number) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  renderSubheaderIfContent: (params: Readonly<{
    text: string;
    nextLineHeight: number;
    hasContent: boolean;
    renderContent: () => void;
    options?: Readonly<{ addTopSpacing?: boolean }>;
  }>) => boolean;
  renderSubheaderWithWrappedText: (subheaderText: string, bodyText: string) => void;
  safeAddWrappedText: (text: string) => void;
  safeAddLeftRightText: (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: Readonly<{
      leftFontStyle?: 'normal' | 'bold';
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
  resolveLoenSkadedatoText: (params: {
    subject: 'lønnen';
    anvendtReguleringsdato: ISODateString | undefined;
    skadedato: ISODateString | undefined;
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
    writeUnderlinedSubheader: (text: string, x?: number) => void;
    writeNormalThenBoldLine: (normalPart: string, boldPart: string) => void;
    writeSignatureBlock: (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => void;
  }>;
}>;

const mergeLoenudviklingSegments = (segments: readonly LoenudviklingSegment[]): readonly LoenudviklingSegment[] => {
  if (segments.length <= 1) return segments;
  const merged: LoenudviklingSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(segment);
      continue;
    }

    const isAdjacent = getDayAfterIso(last.til) === segment.fra;
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
    afsluttesMed,
    NBSP,
    rightColumnWidth,
    renderSectionHeader,
    renderSubheader,
    renderSubheaderIfContent,
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
    resolveLoenSkadedatoText,
    formatDateShort,
    formatDateLong,
    formatPercentDelta,
    writer,
  } = ctx;

  // Hjælpefunktion: skriver "Dokumentation vedlægges som bilag X." med "bilag X." i fed skrift.
  // Kaldes kun når visBilagsnumre er 'Ja' OG der ikke er advarsel for det pågældende nummer.
  const writeBilagReferenceLinje = (bilagsnummer: string | undefined): void => {
    if (!bilagsnummer || bilagsnummer.trim() === '') return;
    writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${bilagsnummer.trim()}.`);
  };

  // Lønindkomst og offentlige ydelser præsenteres under samme indkomstafsnit i PDF'en,
  // så deres bilagsreferencer skrives på én kombineret linje i stedet for to separate.
  const writeCombinedBilagReferenceLinje = (a: string | undefined, b: string | undefined): void => {
    const aTrimmed = a?.trim() ?? '';
    const bTrimmed = b?.trim() ?? '';
    if (aTrimmed && bTrimmed) {
      writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${aTrimmed} og ${bTrimmed}.`);
    } else if (aTrimmed) {
      writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${aTrimmed}.`);
    } else if (bTrimmed) {
      writer.writeNormalThenBoldLine('Dokumentation vedlægges som ', `bilag\u00A0${bTrimmed}.`);
    }
  };

  // Bestem hvilke bilagsnumre der skal vises (ingen advarsel = ingen inkonsistens).
  // Returnerer undefined hvis visBilagsnumre er 'Nej', value er tom, eller der er en advarsel.
  const getBilag = (fieldName: string, value: string | undefined): string | undefined => {
    if (eoValues.visBilagsnumre !== 'Ja') return undefined;
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    return !resolveBilagWarning(eoValues, fieldName, trimmed) ? trimmed : undefined;
  };
  const bilag = {
    menAfgoerelse: getBilag('bilagsnumreMenAfgoerelse', eoValues.bilagsnumreMenAfgoerelse),
    eetAfgoerelser: getBilag('bilagsnumreEetAfgoerelser', eoValues.bilagsnumreEetAfgoerelser),
    svieSmerteDokumentation: getBilag('bilagsnumreSvieSmerteDokumentation', eoValues.bilagsnumreSvieSmerteDokumentation),
    beregningsgrundlagTaf: getBilag('bilagsnumreBeregningsgrundlagTaf', eoValues.bilagsnumreBeregningsgrundlagTaf),
    loenISygeperioden: getBilag('bilagsnumreLoenISygeperioden', eoValues.bilagsnumreLoenISygeperioden),
    offentligeYdelser: getBilag('bilagsnumreOffentligeYdelser', eoValues.bilagsnumreOffentligeYdelser),
    oevrigeErstatningskrav: getBilag('bilagsnumreOevrigeErstatningskrav', eoValues.bilagsnumreOevrigeErstatningskrav),
  };
  const rightMaxWidth = writer.getTextWidth('000.000.000,00');

  if (model.forlig.erIndgaaet) {
    renderSectionHeader('Erstatningsniveau', lineHeight);
    const forligDatoTekst = model.forlig.dato ? `den ${formatDateLong(model.forlig.dato)}` : null;
    const tekst = forligDatoTekst
      ? `Der er ${forligDatoTekst} indgået forlig i sagen på betaling af ${model.forlig.label}.`
      : `Der er indgået forlig i sagen på betaling af ${model.forlig.label}.`;
    safeAddWrappedText(tekst);
  }

  renderSectionHeader('Svie- og smertegodtgørelse', lineHeight);
  assertModelInvariant(
    model.svieSmerte.harPerioder === (model.svieSmerte.periodeLinjer.length > 0),
    'svieSmerte.harPerioder matcher ikke svieSmerte.periodeLinjer.'
  );
  if (!model.svieSmerte.beregnes) {
    safeAddWrappedText('Ingen');
  } else {
    renderSubheaderIfContent({
      text: 'Status',
      nextLineHeight: lineHeight,
      hasContent: model.svieSmerte.statusLinjer.length > 0,
      options: { addTopSpacing: false },
      renderContent: () => {
        for (const line of model.svieSmerte.statusLinjer) {
          safeAddWrappedText(line);
        }
        writeBilagReferenceLinje(bilag.menAfgoerelse);
      },
    });

    renderSubheader(model.svieSmerte.periodeHeading, lineHeight);
    if (!model.svieSmerte.harPerioder) {
      safeAddWrappedText('Ingen');
    } else {
    for (const line of model.svieSmerte.periodeLinjer) {
      safeAddWrappedText(line);
    }
    writeBilagReferenceLinje(bilag.svieSmerteDokumentation);

    renderSubheader('Beregningsgrundlag', lineHeight);
    const satserAar = model.svieSmerte.satserAar !== null ? String(model.svieSmerte.satserAar) : '-';
    safeAddWrappedText(`Beregningen af godtgørelse foretages ud fra satserne i år ${satserAar}.`);

    const perDagDisplayWithKr = renderMoneyWithKrTrimmed(model.svieSmerte.satserPerDag);
    const maxDisplayWithKr = renderMoneyWithKrTrimmed(model.svieSmerte.satserMax);
    const perDagDisplayWithKrFoerForlig = renderMoneyWithKrTrimmed(model.svieSmerte.satserPerDagFoerForlig);
    const maxDisplayWithKrFoerForlig = renderMoneyWithKrTrimmed(model.svieSmerte.satserMaxFoerForlig);
    const forligSatsLabel = model.svieSmerte.forligLabel
      ? model.svieSmerte.forligLabel.replace('%', ' %')
      : null;
    const hasSygedage = model.svieSmerte.sygedage > 0;
    const hasDelviseSygedage = model.svieSmerte.delviseSygedage > 0;
    const visForligMedFuldeSatser =
      forligSatsLabel !== null &&
      model.svieSmerte.satserPerDagFoerForlig.status === 'ok' &&
      model.svieSmerte.satserMaxFoerForlig.status === 'ok';
    if (model.svieSmerte.satserPerDag.status === 'ok') {
      const delvisSatsOre = roundByMethod(model.svieSmerte.satserPerDag.value * model.svieSmerte.delvisFaktor, 0, 'halfAwayFromZero');
      const delvisSatsOreFoerForlig = model.svieSmerte.satserPerDagFoerForlig.status === 'ok'
        ? roundByMethod(model.svieSmerte.satserPerDagFoerForlig.value * model.svieSmerte.delvisFaktor, 0, 'halfAwayFromZero')
        : null;
      const delvisSatsDisplayWithKr = formatMoneyOreWithKrTrimmed(delvisSatsOre);
      const delvisSatsDisplayWithKrFoerForlig = delvisSatsOreFoerForlig === null
        ? null
        : formatMoneyOreWithKrTrimmed(delvisSatsOreFoerForlig);

      const takstLed: string[] = [];
      if (hasSygedage && hasDelviseSygedage && model.svieSmerte.delvisFaktor === 1) {
        takstLed.push(`${perDagDisplayWithKr} pr. sygedag og delvis sygedag`);
      } else {
        if (hasSygedage) {
          takstLed.push(`${perDagDisplayWithKr} pr. sygedag`);
        }
        if (hasDelviseSygedage) {
          takstLed.push(`${delvisSatsDisplayWithKr} pr. delvise sygedag`);
        }
      }

      const takstLedFoerForlig: string[] = [];
      if (hasSygedage && hasDelviseSygedage && model.svieSmerte.delvisFaktor === 1) {
        takstLedFoerForlig.push(`${perDagDisplayWithKrFoerForlig} pr. sygedag og delvis sygedag`);
      } else {
        if (hasSygedage) {
          takstLedFoerForlig.push(`${perDagDisplayWithKrFoerForlig} pr. sygedag`);
        }
        if (hasDelviseSygedage && delvisSatsDisplayWithKrFoerForlig) {
          takstLedFoerForlig.push(`${delvisSatsDisplayWithKrFoerForlig} pr. delvise sygedag`);
        }
      }

      if (visForligMedFuldeSatser && takstLedFoerForlig.length > 0) {
        safeAddWrappedText(
          `Taksten udgør ${forligSatsLabel} af (${takstLedFoerForlig.join(' og ')}, dog højst ${maxDisplayWithKrFoerForlig})`
        );
      } else if (takstLed.length > 0) {
        safeAddWrappedText(`Taksten udgør ${takstLed.join(' og ')}, dog højst ${maxDisplayWithKr}`);
      } else {
        safeAddWrappedText(`Taksten udgør ${perDagDisplayWithKr} pr. sygedag, dog højst ${maxDisplayWithKr}`);
      }
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
    const delvisOre = perDagOre !== null ? roundByMethod(perDagOre * model.svieSmerte.delvisFaktor, 0, 'halfAwayFromZero') : null;

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
    safeAddLeftRightText(lineLeft, beloebDisplay, rightMaxWidth, { rightFontStyle: 'bold' });
    }
  }

  renderSectionHeader('Tabt arbejdsfortjeneste', lineHeight);
  const tafPerioderLines = model.tabtArbejdsfortjeneste.tafPerioderLinjer;
  const hasTafPerioder = model.tabtArbejdsfortjeneste.harTafPerioder;
  assertModelInvariant(hasTafPerioder === (tafPerioderLines.length > 0), 'harTafPerioder matcher ikke tafPerioderLinjer.');

  if (!model.tabtArbejdsfortjeneste.beregnes) {
    safeAddWrappedText('Ingen');
  } else {
    renderSubheaderIfContent({
      text: 'Status',
      nextLineHeight: lineHeight,
      hasContent:
        model.tabtArbejdsfortjeneste.statusLinjer.length > 0 ||
        model.tabtArbejdsfortjeneste.eetLinjer.length > 0 ||
        model.tabtArbejdsfortjeneste.differencekravLinje !== null,
      options: { addTopSpacing: false },
      renderContent: () => {
        for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
          safeAddWrappedText(line);
        }

        if (model.tabtArbejdsfortjeneste.differencekravLinje) {
          safeAddWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
        }
        for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
          safeAddWrappedText(line);
        }
        writeBilagReferenceLinje(bilag.eetAfgoerelser);
      },
    });

    const tafPeriodeHeader = model.tabtArbejdsfortjeneste.tafPerioderLinjer.length > 1
      ? 'Erstatningsperioder, hvor der beregnes tabt arbejdsfortjeneste'
      : 'Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste';
    renderSubheader(tafPeriodeHeader, lineHeight);

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
        rightMaxWidth,
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
            rightMaxWidth,
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
              label: 'Løn i beregningsperioden',
              amountOre: arbejdssted.breakdown.loenPlusLoen2PlusIkkePensLoenOre,
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

          writer.writeUnderlinedSubheader(arbejdssted.navn);

          for (const row of visibleComponentRows) {
            safeAddLeftRightText(
              row.label,
              formatMoneyOreWithKr(row.amountOre),
              rightMaxWidth,
              { rightFontStyle: 'normal' }
            );
          }

          if (visibleComponentRows.length > 1) {
            safeAddLeftRightText('I alt:', formatMoneyOreWithKr(arbejdssted.breakdown.samletOre), rightMaxWidth,
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
          writer.writeUnderlinedSubheader('Offentlige ydelser');
          for (const ydelse of indkomst.offentligeYdelser) {
            safeAddLeftRightText(
              ydelse.label,
              formatMoneyOreWithKr(ydelse.amountOre),
              rightMaxWidth,
              { rightFontStyle: 'normal' }
            );
          }
          if (indkomst.offentligeYdelser.length > 1) {
            safeAddLeftRightText(
              'I alt:',
              formatMoneyOreWithKr(indkomst.offentligeYdelserTotalOre),
              rightMaxWidth,
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
                rightMaxWidth,
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
              ? `Dagsindkomst: (${addends.join(' + ')}${NBSP}kr.) / ${arbejdsdageText} =`
              : `Dagsindkomst: ${formatMoneyOreWithKr(indkomst.samletBeregningsgrundlagOre)} / ${arbejdsdageText} =`;
            safeAddLeftRightText(
              basisText,
              renderMoneyWithKr(indkomst.dagsloen),
              rightMaxWidth,
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
              rightMaxWidth,
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
          rightMaxWidth,
          { rightFontStyle: 'normal' }
        );
      } else if (indkomst?.beregnesUdFra === 'Angivet dagsløn') {
        const venstreTekst = indkomst.loenBaseretPaa
          ? `På baggrund af ${indkomst.loenBaseretPaa} lægges en dagsløn til grund på`
          : 'Der lægges en dagsløn til grund på';
        safeAddLeftRightText(
          venstreTekst,
          renderMoneyWithKrOrError(indkomst.dagsloen),
          rightMaxWidth,
          { rightFontStyle: 'normal' }
        );
      }
    }
    writeBilagReferenceLinje(bilag.beregningsgrundlagTaf);

    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    // Brug den aktive lønudviklings-ansættelse til at resolve kanonisk reguleringsdato.
    // `resolveAnvendtReguleringsdato` er den kanoniske sandhed — ingen lokal fallback-logik.
    const aktivLoenudviklingAf = (() => {
      const ansaettelser = resolveLoenudviklingKilde(eoValues);
      return ansaettelser.find(
        (af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen'
      ) ?? ansaettelser[0];
    })();
    const skadedatoIso = parseOptionalIsoDate(stamdataValues.skadedato);
    const anvendtReguleringsdatoForOpgoerelse = aktivLoenudviklingAf
      ? resolveAnvendtReguleringsdato(stamdataValues, eoValues, aktivLoenudviklingAf)
      : undefined;
    const loenSkadedatoText = resolveLoenSkadedatoText({
      subject: 'lønnen',
      anvendtReguleringsdato: anvendtReguleringsdatoForOpgoerelse,
      skadedato: skadedatoIso,
    });
    const indkomstHvisSkadeIkkeIndtraadtBeskrivelse = loenudvikling?.loenudviklingLabel === 'Ingen'
      ? `Opgøres på baggrund af ${loenSkadedatoText}.`
      : `Beregnes som ${loenSkadedatoText} tillagt efterfølgende lønstigninger.`;
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
          writer.writeUnderlinedSubheader(entry.ansaettelsesforholdNavn);
          renderLoenudviklingSegments(entry.beregnedeSegmenter, entry.loenudviklingTotal, false);
        }
        if (loenudvikling.loenudviklingTotal.status === 'ok') {
          writer.addSpacer(lineHeight);
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
      for (const entry of tafIndtaegter.entries) {
        safeAddLeftRightText(entry.label, formatMoneyOreWithKr(entry.amountOre), rightMaxWidth, { rightFontStyle: 'normal' });
      }
      const sygeferiegodtgoerelseOre = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre;
      const harValgtSygeferiegodtgoerelse = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0;
      if (harValgtSygeferiegodtgoerelse) {
        safeAddLeftRightText('Sygeferiegodtgørelse', formatMoneyOreWithKr(sygeferiegodtgoerelseOre), rightMaxWidth, { rightFontStyle: 'normal' });
      }

      const harTafIndtaegterEntries = tafIndtaegter.entries.length > 0 || harValgtSygeferiegodtgoerelse;
      const skalViseTotal = tafIndtaegter.entries.length + (harValgtSygeferiegodtgoerelse ? 1 : 0) > 1;
      const tafIndtaegterTotalOre =
        tafIndtaegter.total.status === 'ok'
          ? tafIndtaegter.total.value + (harValgtSygeferiegodtgoerelse ? sygeferiegodtgoerelseOre : 0)
          : null;

      if (!harTafIndtaegterEntries) {
        safeAddWrappedText('Ingen');
      } else if (skalViseTotal && tafIndtaegterTotalOre !== null) {
        safeAddLeftRightText('I alt', formatMoneyOreWithKr(tafIndtaegterTotalOre), rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 });
      } else if (skalViseTotal) {
        safeAddLeftRightText('I alt', '—', rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 });
      }
    }
    writeCombinedBilagReferenceLinje(bilag.loenISygeperioden, bilag.offentligeYdelser);

    const loenudviklingTotal = model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal ?? null;
    const tafTotal = model.tabtArbejdsfortjeneste.tafIndtaegter?.total ?? null;
    const tidligereModtagetTaf = model.tabtArbejdsfortjeneste.tidligereModtagetTaf;
    if (tidligereModtagetTaf.status === 'ok') {
      renderSubheader('Tidligere betalt erstatning', lineHeight);
      safeAddLeftRightText(
        'Der er allerede betalt tabt arbejdsfortjeneste for perioden med',
        formatMoneyOreWithKr(tidligereModtagetTaf.value),
        rightMaxWidth,
        { rightFontStyle: 'normal' }
      );
    }

    if (loenudviklingTotal && tafTotal && loenudviklingTotal.status === 'ok' && tafTotal.status === 'ok') {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);

      const ledFoerLigmed = [formatCurrencyFromOre(loenudviklingTotal.value)];
      const sygeferiegodtgoerelseOre = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre;
      const harValgtSygeferiegodtgoerelse = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0;
      const samledeIndtaegterIErstatningsperiodenOre =
        tafTotal.value + (harValgtSygeferiegodtgoerelse ? sygeferiegodtgoerelseOre : 0);
      if (samledeIndtaegterIErstatningsperiodenOre !== 0) {
        ledFoerLigmed.push(formatCurrencyFromOre(samledeIndtaegterIErstatningsperiodenOre));
      }
      const expressionText = `${ledFoerLigmed
        .map((led, index) => (index === ledFoerLigmed.length - 1 ? `${led}${NBSP}kr.` : led))
        .join(' - ')}`;
      const leftText = (() => {
        if (model.forlig.erIndgaaet) {
          if (tidligereModtagetTaf.status === 'ok' && tidligereModtagetTaf.value !== 0) {
            return `${model.forlig.label} x (${expressionText}) - ${formatMoneyOreWithKr(tidligereModtagetTaf.value)} =`;
          }
          return `${model.forlig.label} x (${expressionText}) =`;
        }
        if (tidligereModtagetTaf.status === 'ok' && tidligereModtagetTaf.value !== 0) {
          return `${expressionText} - ${formatMoneyOreWithKr(tidligereModtagetTaf.value)} =`;
        }
        return `${expressionText} =`;
      })();
      const rightText = formatMoneyOreWithKr(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
      safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'bold' });
    } else if (model.tabtArbejdsfortjeneste.harTafPerioder) {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);
      safeAddLeftRightText('Beregnet krav på tabt arbejdsfortjeneste', '—', rightMaxWidth, { rightFontStyle: 'bold' });
    }
    }
  }

  const kravEntries = model.oevrigeKrav.entries;
  const kravRightMaxWidth = rightMaxWidth;
  const kravHeaderHeight = lineHeight * 4;
  const oevrigeKravIntroLinjer = resolveOevrigeKravIntroLinjer({
    eoValues,
    ydelser: model.tabtArbejdsfortjeneste.tafIndtaegter?.oevrigeKravForbeholdYdelsestyper ?? [],
  });
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
      safeAddLeftRightText('I alt', formatMoneyOreWithKr(model.oevrigeKrav.totalFoerForligOre), kravRightMaxWidth, { rightFontStyle: 'bold', lineAboveRightWidth: rightColumnWidth, lineAboveRightOffset: 4 });
    }

    if (model.forlig.erIndgaaet) {
      renderSubheader('Beregnet krav på øvrige krav', lineHeight);
      const leftText = `${model.forlig.label} x (${formatCurrencyFromOre(model.oevrigeKrav.totalFoerForligOre)}${NBSP}kr.) =`;
      safeAddLeftRightText(leftText, formatMoneyOreWithKr(model.oevrigeKrav.totalOre), kravRightMaxWidth, { rightFontStyle: 'bold' });
    }
  }
  writeBilagReferenceLinje(bilag.oevrigeErstatningskrav);
  renderSectionHeader('Samlet erstatningskrav', lineHeight);

  const periodeFraKort = model.periode?.fra ? formatDateShort(model.periode.fra) : '';
  const periodeTilKort = model.periode?.til ? formatDateShort(model.periode.til) : '';
  const periodeText =
    periodeFraKort && periodeTilKort
      ? `Det samlede krav for perioden ${periodeFraKort} - ${periodeTilKort} udgør:`
      : 'Det samlede krav udgør:';
  safeAddWrappedText(periodeText);
  writer.advanceY(lineHeight);

  const summaryRightMaxWidth = rightMaxWidth;
  safeAddLeftRightText('Svie- og smertegodtgørelse', formatMoneyOreWithKr(model.samlet.svieSmerteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  safeAddLeftRightText('Tabt arbejdsfortjeneste', formatMoneyOreWithKr(model.samlet.tabtArbejdsfortjenesteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  safeAddLeftRightText('Øvrige krav', formatMoneyOreWithKr(model.samlet.oevrigeKravOre), summaryRightMaxWidth, { rightFontStyle: 'normal' });
  safeAddLeftRightText('Erstatningskrav i alt', formatMoneyOreWithKr(model.samlet.totalOre), summaryRightMaxWidth, {
    leftFontStyle: 'bold',
    rightFontStyle: 'bold',
    lineAboveRightWidth: rightColumnWidth,
    lineAboveRightOffset: 4,
  });
  const saerligeKommentarer = model.saerligeKommentarer;
  if (saerligeKommentarer) {
    renderSectionHeader('Særlige bemærkninger', lineHeight);
    safeAddWrappedText(saerligeKommentarer);
  }
  renderSectionHeader('Godkendelse', lineHeight);
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
