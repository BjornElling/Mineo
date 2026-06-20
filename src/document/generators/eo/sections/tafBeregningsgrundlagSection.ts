/**
 * Delt rendering af TAF-"Beregningsgrundlag" + "Forventet indkomst"-introtekst.
 *
 * Udtrukket fra `opgoerelseSection.ts` så både den almindelige erstatningsopgørelse
 * og "TAF opreguleret til beregningsåret"-PDF'en kan vise præcis samme beregnings-
 * grundlag (dagsløn/månedsløn ved skadestidspunktet) og samme introtekst til
 * forventet indkomst.
 *
 * Funktionerne her ændrer ikke noget output — de flytter blot eksisterende logik
 * til ét sted, så de to dokumenter forbliver konsistente.
 */

import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { resolveAktivEllerFoersteLoenudviklingKilde } from '../../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
import type { Calculable, MoneyOre, EoModel } from '../../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';

export type TafBeregningsgrundlagDeps = Readonly<{
  model: EoModel;
  lineHeight: number;
  rightColumnWidth: number;
  rightMaxWidth: number;
  NBSP: string;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
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
  renderMoneyWithKr: (value: Calculable<MoneyOre>) => string;
  renderMoneyWithKrOrError: (value: Calculable<MoneyOre>) => string;
  formatMoneyOreWithKr: (ore: MoneyOre) => string;
  formatCurrencyFromOre: (ore: MoneyOre) => string;
  formatCountWithUnit: (value: number, singular: string, plural: string) => string;
  formatMaanederTrimmed: (value: number) => string;
  isSingularCount: (value: number) => boolean;
  writer: Readonly<{
    addSectionSpacer: () => void;
    ensureSpace: (height: number) => void;
    writeUnderlinedSubheader: (text: string, x?: number) => void;
  }>;
}>;

/**
 * Renderer "Beregningsgrundlag"-underafsnittet (dagsløn/månedsløn ved skadestidspunktet).
 * Identisk med blokken i `opgoerelseSection.ts`.
 */
export const renderTafBeregningsgrundlag = (deps: TafBeregningsgrundlagDeps): void => {
  const {
    model,
    lineHeight,
    rightColumnWidth,
    rightMaxWidth,
    NBSP,
    renderSubheader,
    safeAddWrappedText,
    safeAddLeftRightText,
    renderMoneyWithKr,
    renderMoneyWithKrOrError,
    formatMoneyOreWithKr,
    formatCurrencyFromOre,
    formatCountWithUnit,
    formatMaanederTrimmed,
    isSingularCount,
    writer,
  } = deps;

  renderSubheader('Beregningsgrundlag');
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
    return;
  }

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
      writer.addSectionSpacer();
    } else if (indkomst?.beregningsgrundlagMellemregningLabel) {
      safeAddWrappedText(indkomst.beregningsgrundlagMellemregningLabel);
      writer.addSectionSpacer();
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
    }
    if (indkomst.offentligeYdelser.length > 0) {
      // Underoverskriften "Offentlige ydelser" har selv den kanoniske top-afstand (B5.1/B6) —
      // den adskiller fra det foregående arbejdssted-/I alt-afsnit. En manuel spacer ville
      // give en tom linje før overskriften i Word (Heading-typografiens before-spacing oveni).
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
      writer.addSectionSpacer();
    }

    if (indkomst.samletBeregningsgrundlagOre !== null) {
      const addends = indkomst.arbejdssteder.map((arbejdssted) =>
        formatCurrencyFromOre(arbejdssted.breakdown.samletOre)
      );
      if (indkomst.offentligeYdelserTotalOre > 0) {
        addends.push(formatCurrencyFromOre(indkomst.offentligeYdelserTotalOre));
      }
      if (udskydMellemregningVedBeregningsperiode) {
        // Linjeafstand mellem arbejdssted-"I alt:" og mellemregningen ("I perioden var
        // der N måneder."). Når der er offentlige ydelser, har dét afsnit allerede tilføjet
        // en spacer (ovenfor), så her tilføjes kun en, når der ikke var offentlige ydelser.
        if (indkomst.offentligeYdelser.length === 0) {
          writer.addSectionSpacer();
        }
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
};

export type TafForventetIndkomstIntroDeps = Readonly<{
  model: EoModel;
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  parseOptionalIsoDate: (value: string | undefined) => ISODateString | undefined;
  resolveLoenSkadedatoText: (params: {
    subject: 'lønnen';
    anvendtReguleringsdato: ISODateString | undefined;
    skadedato: ISODateString | undefined;
    useUntilWordingForImplicitBeregningsperiodeDate?: boolean;
  }) => string;
  formatDateLong: (isoDate: ISODateString | undefined) => string;
}>;

/**
 * Beregner introteksten til "Forventet indkomst" (kan være flere linjer adskilt af \n).
 * Identisk med `resolveIndkomstBeregningsText` i `opgoerelseSection.ts`.
 */
export const resolveTafForventetIndkomstIntroText = (deps: TafForventetIndkomstIntroDeps): string => {
  const { model, eoValues, stamdataValues, parseOptionalIsoDate, resolveLoenSkadedatoText, formatDateLong } = deps;

  const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
  const aktivLoenudviklingAf = resolveAktivEllerFoersteLoenudviklingKilde(eoValues);
  const skadedatoIso = parseOptionalIsoDate(stamdataValues.skadedato);
  const anvendtReguleringsdatoForOpgoerelse = aktivLoenudviklingAf
    ? resolveAnvendtReguleringsdato(stamdataValues, eoValues, aktivLoenudviklingAf)
    : undefined;
  const loenSkadedatoText = resolveLoenSkadedatoText({
    subject: 'lønnen',
    anvendtReguleringsdato: anvendtReguleringsdatoForOpgoerelse,
    skadedato: skadedatoIso,
    useUntilWordingForImplicitBeregningsperiodeDate:
      eoValues.beregnesUdFra === 'Beregningsperiode'
      && !aktivLoenudviklingAf?.saerligFraDatoRegulering
      && Boolean(
        aktivLoenudviklingAf
        && eoValues.tafBeregningsperiodeTil
        && anvendtReguleringsdatoForOpgoerelse === eoValues.tafBeregningsperiodeTil
      ),
  });
  const offentligeYdelserUdvikling = model.tabtArbejdsfortjeneste.offentligeYdelserUdvikling;
  const harOffentligeYdelserUdvikling = Boolean(offentligeYdelserUdvikling && offentligeYdelserUdvikling.entries.length > 0);
  const offentligeYdelserReguleringText =
    offentligeYdelserUdvikling?.reguleringsLabel === 'Ingen'
      ? 'uden statslig regulering per 1. januar'
      : 'med statslig regulering per 1. januar';
  const offentligeYdelserBaseText = offentligeYdelserUdvikling?.reguleringsBaseIso
    ? ` per ${formatDateLong(offentligeYdelserUdvikling.reguleringsBaseIso)}`
    : '';
  const resolveLoenDatoFragment = (
    anvendtReguleringsdato: ISODateString | undefined,
    brugFremTilFormulering: boolean
  ): string => {
    if (anvendtReguleringsdato && anvendtReguleringsdato !== skadedatoIso) {
      const formatted = formatDateLong(anvendtReguleringsdato);
      if (formatted) {
        return brugFremTilFormulering ? `frem til ${formatted}` : `per ${formatted}`;
      }
    }
    return 'på skadedatoen';
  };
  const resolvePerAnsaettelseLoenTekst = (): string | undefined => {
    if (!loenudvikling || loenudvikling.perAnsaettelse.length <= 1) return undefined;
    const ansaettelserById = new Map(
      eoValues.loenindkomstAnsaettelsesforhold.map((af) => [af.id, af] as const)
    );
    const fragmenter = loenudvikling.perAnsaettelse.map((entry) => {
      const af = ansaettelserById.get(entry.ansaettelsesforholdId);
      const anvendtReguleringsdato = af
        ? resolveAnvendtReguleringsdato(stamdataValues, eoValues, af)
        : undefined;
      const brugFremTilFormulering =
        eoValues.beregnesUdFra === 'Beregningsperiode'
        && !af?.saerligFraDatoRegulering
        && Boolean(
          af
          && eoValues.tafBeregningsperiodeTil
          && anvendtReguleringsdato === eoValues.tafBeregningsperiodeTil
        );
      const datoFragment = resolveLoenDatoFragment(anvendtReguleringsdato, brugFremTilFormulering);
      const tillaeg = entry.loenudviklingLabel === 'Ingen'
        ? ''
        : ' tillagt efterfølgende lønstigninger';
      return `${entry.ansaettelsesforholdNavn} ${datoFragment}${tillaeg}`;
    });
    const sammensat = fragmenter.length === 1
      ? fragmenter[0]
      : `${fragmenter.slice(0, -1).join(', ')} og ${fragmenter[fragmenter.length - 1]}`;
    return `Beregnes som lønnen opgjort således: ${sammensat}.`;
  };
  const perAnsaettelseTekst = resolvePerAnsaettelseLoenTekst();
  const loenTekst = perAnsaettelseTekst ?? (
    loenudvikling?.loenudviklingLabel === 'Ingen' || !loenudvikling
      ? `Opgøres på baggrund af ${loenSkadedatoText}.`
      : `Beregnes som ${loenSkadedatoText} tillagt efterfølgende lønstigninger.`
  );
  if (!harOffentligeYdelserUdvikling) return loenTekst;
  return `${loenTekst}\nOffentlige ydelser beregnes${offentligeYdelserBaseText} ${offentligeYdelserReguleringText}.`;
};
