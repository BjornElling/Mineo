import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { isISODateString } from '../../../types/branded';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { formatAsAmount, formatAsAmountTrimmed, formatPercent, isSingularCount } from '../../../utils/formatUtils';
import { parsePercentPointString } from '../../../utils/numberParsing';
import { roundByMethod } from '../../../utils/rounding';
import { calculateStandardLoenDerivedFromAmounts } from '../../aarsloen/standardLoenRowCalculations';
import { buildIncomeForRanges, type IncomePeriodResult } from '../helpers/indtaegtPerioder';
import { buildLoenindkomstRateSegments, resolveAutoStoreBededagPct } from '../helpers/loenindkomstSatser';
import { calculateTafAntalMaaneder, calculateTafArbejdsdageBreakdown } from '../engines/tafCalculations';
import { sumMaanedsbroekForInterval } from '../engines/periodiseringsMotor';
import { TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { getAngivetLoenBaseretPaa } from '../helpers/angivetLoenHelpers';
import type { Calculable, IndkomstSkadestidspunktModel, MoneyOre } from '../shared/eoTypes';
import { asCalculable, clampMoneyOreToZero, ensureMoneyOre, fromOre, roundKroner, toOre } from '../shared/eoMoney';
import { formatPercentFixed2, resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import { formatISOToDanish as formatDateShort } from '../../../utils/dateFormatting';

const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);
// Pct-point-parsing via den kanoniske parser (dansk locale, ingen lossy /100*100-round-trip).
// Bevarer den oprindelige fallback: tom/undefined -> undefined; ikke-parsbar streng -> 0.
const parsePctPoint = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') return parsePercentPointString(value) ?? 0;
  return undefined;
};

export const buildIndkomstSkadestidspunkt = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  options?: Readonly<{
    incomeForBeregningsperiode?: IncomePeriodResult | null;
  }>
): IndkomstSkadestidspunktModel | null => {
  const beregnesUdFra = values.beregnesUdFra;
  const loenBaseretPaa = getAngivetLoenBaseretPaa(values)?.trim() ?? '';
  const skadedato = isISODateString(stamdataValues.skadedato) ? stamdataValues.skadedato : null;

  const tafBeregningsperiodeFra = values.tafBeregningsperiodeFra;
  const tafBeregningsperiodeTil = values.tafBeregningsperiodeTil;
  const periodeTilBeregning =
    tafBeregningsperiodeFra && tafBeregningsperiodeTil
      ? { fra: tafBeregningsperiodeFra, til: tafBeregningsperiodeTil }
      : null;

  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const ansaettelserNavne: string[] = [];

  const arbejdssteder: Array<IndkomstSkadestidspunktModel['arbejdssteder'][number]> = [];
  let offentligeYdelser: Array<IndkomstSkadestidspunktModel['offentligeYdelser'][number]> = [];
  let offentligeYdelserTotalOre: MoneyOre = ensureMoneyOre(0);
  let samletBeregningsgrundlagOre: MoneyOre | null = null;
  let totalBreakdown: IndkomstSkadestidspunktModel['totalBreakdown'] = null;
  let arbejdsdage: number | null = null;
  let maaneder: number | null = null;
  let maanedsloen: Calculable<MoneyOre> = notCalculableMoney('Ikke angivet');
  let dagsloen: Calculable<MoneyOre> = notCalculableMoney('Ikke angivet');
  let beregningsperiodeLabel: string | null = null;
  let beregningsgrundlagMellemregningLabel: string | null = null;
  let beregningsgrundlagMellemregningResultat: string | null = null;

  if (beregnesUdFra === 'Beregningsperiode') {
    if (periodeTilBeregning) {
      const fraText = formatDateShort(periodeTilBeregning.fra);
      const tilText = formatDateShort(periodeTilBeregning.til);
      if (fraText && tilText) {
        beregningsperiodeLabel = `Opgøres på baggrund af indkomsten i perioden ${fraText} - ${tilText}.`;
      }
    }

    if (periodeTilBeregning) {
      // Beregningsperiode-indkomsten opgøres med de satser der gælder på reguleringsdato (af.pensionPct m.fl.),
      // ikke med historisk segmentering — derfor sendes skadedato ikke med her.
      const incomeForBeregningsperiode =
        options?.incomeForBeregningsperiode
        ?? buildIncomeForRanges(values, [periodeTilBeregning], undefined, undefined);
      const sums = { loenPlusLoen2: 0, loenPlusLoen2PlusIkkePensLoen: 0, fpFvShSo: 0, pension: 0, atp: 0, samlet: 0 };

      for (const entry of incomeForBeregningsperiode.employers) {
        const af = ansaettelser[entry.index];
        if (!af) continue;
        const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
          beregnesUdFra: values.beregnesUdFra,
          angivetLoenMetodeOpreguleresFraDato: undefined,
          saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
          beregningsperiodeTil: values.tafBeregningsperiodeTil,
          skadedato: skadedato ?? undefined,
        });
        const satser = (() => {
          const baseSatser = {
            feriePct: af.feriePct,
            fritvalgPct: af.fritvalgPct,
            shSoPct: af.shSoPct,
            storeBededagPct: af.storeBededagPct,
            pensionPct: af.pensionPct,
          };
          if (!anvendtReguleringsdato) return baseSatser;
          if (af.loenudviklingBeregningsgrundlag === 'Manuelt angivet') {
            const manualRows = af.loenudviklingManuelTableData ?? [];
            const datedRow = manualRows
              .slice(1)
              .filter((row) => {
                return Boolean(row.dato && row.dato <= anvendtReguleringsdato);
              })
              .sort((left, right) => {
                return (left.dato ?? '').localeCompare(right.dato ?? '');
              })
              .at(-1);
            return {
              feriePct: parsePctPoint(datedRow?.feriepenge) ?? af.feriePct,
              fritvalgPct: parsePctPoint(datedRow?.fritvalg) ?? af.fritvalgPct,
              shSoPct: parsePctPoint(datedRow?.shSoSats) ?? af.shSoPct,
              storeBededagPct: resolveAutoStoreBededagPct(af, anvendtReguleringsdato),
              pensionPct: parsePctPoint(datedRow?.agPension) ?? af.pensionPct,
            };
          }
          const satssegment = buildLoenindkomstRateSegments({
            ansaettelsesforhold: af,
            skadedato: skadedato ?? undefined,
            fra: anvendtReguleringsdato,
            til: anvendtReguleringsdato,
          })[0];
          return satssegment?.satser ?? baseSatser;
        })();
        const recalculatedBreakdown = calculateStandardLoenDerivedFromAmounts(
          {
            loen: entry.breakdown.loenPlusLoen2,
            loen2: 0,
            ikkePensionsgivende: entry.breakdown.loenPlusLoen2PlusIkkePensLoen - entry.breakdown.loenPlusLoen2,
            atp: entry.breakdown.atp,
          },
          {
            feriePct: satser.feriePct,
            fritvalgPct: satser.fritvalgPct,
            shSoPct: satser.shSoPct,
            storeBededagPct: satser.storeBededagPct,
            pensionPct: satser.pensionPct,
          }
        );
        const feriePct = parsePctPoint(satser.feriePct);
        const fritvalgPct = parsePctPoint(satser.fritvalgPct);
        const shSoPct = parsePctPoint(satser.shSoPct);
        const storeBededagPct = parsePctPoint(satser.storeBededagPct);
        const pensionPct = parsePctPoint(satser.pensionPct);
        const pctParts: string[] = [];
        if (feriePct && feriePct !== 0) pctParts.push(`Feriepenge (${formatPercent(feriePct)})`);
        if (fritvalgPct && fritvalgPct !== 0) pctParts.push(`Fritvalg (${formatPercent(fritvalgPct)})`);
        if (shSoPct && shSoPct !== 0) pctParts.push(`S/H (${formatPercent(shSoPct)})`);
        if (storeBededagPct && storeBededagPct !== 0) {
          pctParts.push(`Store Bededag (${formatPercentFixed2(storeBededagPct)})`);
        }
        const fpLabel = pctParts.length > 0 ? pctParts.join(' + ') : 'Feriepenge m.v.';
        const pensionLabel = pensionPct && pensionPct !== 0
          ? `Arbejdsgivers pensionsbidrag (${formatPercent(pensionPct)} af løn + tillæg)`
          : 'Arbejdsgivers pensionsbidrag';
        const navn = entry.name !== '' ? entry.name : ((af.navnPaaArbejdssted ?? '').trim() || 'Arbejdssted');

        sums.loenPlusLoen2 += entry.breakdown.loenPlusLoen2;
        sums.loenPlusLoen2PlusIkkePensLoen += entry.breakdown.loenPlusLoen2PlusIkkePensLoen;
        sums.fpFvShSo += recalculatedBreakdown.fpFvShSo;
        sums.pension += recalculatedBreakdown.pension;
        sums.atp += entry.breakdown.atp;
        sums.samlet += recalculatedBreakdown.samlet;

        arbejdssteder.push({
          navn,
          fpLabel,
          pensionLabel,
          breakdown: {
            loenPlusLoen2Ore: toOre(roundKroner(entry.breakdown.loenPlusLoen2)),
            loenPlusLoen2PlusIkkePensLoenOre: toOre(roundKroner(entry.breakdown.loenPlusLoen2PlusIkkePensLoen)),
            fpFvShSoOre: toOre(roundKroner(recalculatedBreakdown.fpFvShSo)),
            pensionOre: toOre(roundKroner(recalculatedBreakdown.pension)),
            atpOre: toOre(roundKroner(entry.breakdown.atp)),
            samletOre: clampMoneyOreToZero(toOre(roundKroner(recalculatedBreakdown.samlet))),
          },
        });
      }

      for (const arbejdssted of arbejdssteder) {
        if (arbejdssted.navn !== '' && !ansaettelserNavne.includes(arbejdssted.navn)) {
          ansaettelserNavne.push(arbejdssted.navn);
        }
      }

      if (arbejdssteder.length > 0) {
        totalBreakdown = {
          loenPlusLoen2Ore: toOre(roundKroner(sums.loenPlusLoen2)),
          loenPlusLoen2PlusIkkePensLoenOre: toOre(roundKroner(sums.loenPlusLoen2PlusIkkePensLoen)),
          fpFvShSoOre: toOre(roundKroner(sums.fpFvShSo)),
          pensionOre: toOre(roundKroner(sums.pension)),
          atpOre: toOre(roundKroner(sums.atp)),
          samletOre: clampMoneyOreToZero(toOre(roundKroner(sums.samlet))),
        };
      }

      offentligeYdelser = incomeForBeregningsperiode.benefits
        .map((benefit) => ({
          label: benefit.label,
          amountOre: clampMoneyOreToZero(toOre(roundKroner(benefit.amount))),
        }))
        .filter((benefit) => benefit.amountOre > 0);
      offentligeYdelserTotalOre = offentligeYdelser.reduce<MoneyOre>(
        (sum, benefit) => ensureMoneyOre(sum + benefit.amountOre),
        ensureMoneyOre(0)
      );
    }
    const samletLoenOre = totalBreakdown?.samletOre ?? ensureMoneyOre(0);
    samletBeregningsgrundlagOre = clampMoneyOreToZero(ensureMoneyOre(samletLoenOre + offentligeYdelserTotalOre));

    const oevrigeFravaersdage =
      values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
        ? values.oevrigeFravaersdage
        : 0;
    if (periodeTilBeregning) {
      const formatDaNumber = (value: number): string => formatAsAmount(value, 0);
      const formatMaaneder = (value: number): string => formatAsAmountTrimmed(value, 2);
      const dagOrd = (value: number, singular: string, plural: string): string => (isSingularCount(value) ? singular : plural);

      const maanederResult = calculateTafAntalMaaneder(
        periodeTilBeregning.fra,
        periodeTilBeregning.til,
        oevrigeFravaersdage
      );
      maaneder = maanederResult;
      if (maanederResult && samletBeregningsgrundlagOre && samletBeregningsgrundlagOre > 0) {
        const base = fromOre(samletBeregningsgrundlagOre) / maanederResult;
        maanedsloen = asCalculable(toOre(roundKroner(base)));
      }

      if (tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER && maanederResult !== null) {
        const oevrigeFravaersdageValue = oevrigeFravaersdage;
        // Samme "antal måneder ud fra dage"-princip som beregningsgrundlaget; brug den kanoniske
        // motor-helper i stedet for en lokal dag-for-dag-løkke (ingen materialiseret dag-Set, og
        // de to implementeringer kan ikke længere drive fra hinanden). Resultatet er identisk
        // efter den 2-decimal-afrunding nedenfor.
        const totalMaaneder = sumMaanedsbroekForInterval(periodeTilBeregning.fra, periodeTilBeregning.til);
        const fravaerMaaneder = oevrigeFravaersdageValue * TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR;
        const roundedTotalMaaneder = roundByMethod(totalMaaneder, 2, 'halfAwayFromZero');
        const roundedFravaerMaaneder = roundByMethod(fravaerMaaneder, 2, 'halfAwayFromZero');
        const maanederEfterFradrag = Math.max(
          0,
          roundByMethod(roundedTotalMaaneder - roundedFravaerMaaneder, 2, 'halfAwayFromZero')
        );
        if (oevrigeFravaersdageValue === 0) {
          const maanedsOrd = dagOrd(roundedTotalMaaneder, 'måned', 'måneder');
          beregningsgrundlagMellemregningLabel = `I perioden var der ${formatMaaneder(totalMaaneder)} ${maanedsOrd}.`;
          beregningsgrundlagMellemregningResultat = null;
        } else {
          const fravaerBeskrivelse =
            values.oevrigtFravaerUdenLoen === 'Ja'
              ? values.oevrigeFravaersdageBeskrivelse?.trim()
              : '';
          const fravaersdagOrd = dagOrd(oevrigeFravaersdageValue, 'fraværsdag', 'fraværsdage');
          const fravaerLabelTekst = fravaerBeskrivelse && fravaerBeskrivelse !== ''
            ? `${fravaersdagOrd} pga. ${fravaerBeskrivelse}`
            : fravaersdagOrd;
          const fravaerLabel = `${formatDaNumber(oevrigeFravaersdageValue)} ${fravaerLabelTekst} uden løn x 4,8 % måned`;
          beregningsgrundlagMellemregningLabel =
            `I perioden var der ${formatMaaneder(totalMaaneder)} - ${formatMaaneder(fravaerMaaneder)} måneder (${fravaerLabel}) =`;
          beregningsgrundlagMellemregningResultat = `${formatMaaneder(maanederEfterFradrag)} måneder`;
        }
      }

      const loseFeriedage = typeof values.uspecificeredeFerieFridage === 'number' ? values.uspecificeredeFerieFridage : 0;
      const arbejdsdageBreakdown = calculateTafArbejdsdageBreakdown(
        periodeTilBeregning.fra,
        periodeTilBeregning.til,
        values.fravaerPerioder ?? [],
        loseFeriedage,
        { kind: 'beregningsgrundlag', oevrigeFravaersdage }
      );
      if (arbejdsdageBreakdown) {
        arbejdsdage = Math.max(0, arbejdsdageBreakdown.tafDage);
        if (
          arbejdsdage > 0 &&
          samletBeregningsgrundlagOre &&
          samletBeregningsgrundlagOre > 0 &&
          tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
        ) {
          const base = fromOre(samletBeregningsgrundlagOre) / arbejdsdage;
          dagsloen = asCalculable(toOre(roundKroner(base)));
        }

        if (tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
          const samletFeriedage = arbejdsdageBreakdown.feriedage + arbejdsdageBreakdown.loseFeriedage;
          const basePart = `${formatDaNumber(arbejdsdageBreakdown.arbejdsdage)} ${dagOrd(arbejdsdageBreakdown.arbejdsdage, 'hverdag', 'hverdage')}`;
          const fradragComponents: Array<{ value: number; label: string }> = [
            { value: arbejdsdageBreakdown.shDage, label: dagOrd(arbejdsdageBreakdown.shDage, 'SH-dag', 'SH-dage') },
            { value: samletFeriedage, label: dagOrd(samletFeriedage, 'ferie-/feriefridag', 'ferie-/feriefridage') },
            { value: arbejdsdageBreakdown.oevrigeFravaersdage, label: dagOrd(arbejdsdageBreakdown.oevrigeFravaersdage, 'øvrig fraværsdag', 'øvrige fraværsdage') },
          ];
          const fradragParts = fradragComponents
            .filter((component) => component.value > 0)
            .map((component) => `${formatDaNumber(component.value)} ${component.label}`);
          beregningsgrundlagMellemregningLabel = fradragParts.length > 0
            ? `I perioden var der ${basePart} - ${fradragParts.join(' - ')} =`
            : 'I perioden var der';
          beregningsgrundlagMellemregningResultat = `${formatDaNumber(arbejdsdage)} arbejdsdage`;
        }
      }
    }
  } else if (beregnesUdFra === 'Angivet månedsløn') {
    const value = amountValueToNumber(values.maanedsloenenUdgoer);
    if (value !== undefined) {
      maanedsloen = asCalculable(toOre(value));
    } else {
      maanedsloen = notCalculableMoney('Månedsløn mangler');
    }
  } else if (beregnesUdFra === 'Angivet dagsløn') {
    const value = amountValueToNumber(values.dagsloenenUdgoer);
    if (value !== undefined) {
      dagsloen = asCalculable(toOre(value));
    } else {
      dagsloen = notCalculableMoney('Dagsløn mangler');
    }
  }

  return {
    beregningsenhed: tafBeregningsenhed,
    beregnesUdFra,
    loenBaseretPaa: loenBaseretPaa !== '' ? loenBaseretPaa : null,
    skadedato,
    periodeTilBeregning,
    ansaettelserNavne,
    arbejdssteder,
    offentligeYdelser,
    offentligeYdelserTotalOre,
    samletBeregningsgrundlagOre,
    totalBreakdown,
    arbejdsdage,
    maaneder,
    maanedsloen,
    dagsloen,
    beregningsperiodeLabel,
    beregningsgrundlagMellemregningLabel,
    beregningsgrundlagMellemregningResultat,
  };
};
