import { isoToDanish } from '../../../types/branded';
import { getDayAfterIso, getDayBeforeIso, type IsoRange } from '../../../utils/isoDateHelpers';
import { mergeIsoDateRanges } from '../engines/isoRangeAlgebra';
import { calculateFerieHverdageMinusSHDage } from '../engines/ferieCalculations';
import { buildBeregningsperiodeRange, buildIncomeSourceRanges } from '../helpers/indtaegtPerioder';
import type { TafCalculationValues } from '../engines/tafCalculationInput';

/**
 * Perioder i beregningsperioden, hvor der hverken er en lønrække eller en offentlig ydelse (BB-260).
 *
 * Beregningsperiodens løn deles med alle periodens måneder eller arbejdsdage. En for tidlig fra-dato eller et
 * glemt år lønsedler halverede derfor månedslønnen uden et spor på skærmen. Huller kan være rigtige, men den
 * almindeligste lovlige form – dagpenge i en periode – registreres under Offentlige ydelser og tæller som
 * indkomst; den giver derfor ingen advarsel. Udviklerafgørelse 2026-10-02: en gul, ikke-blokerende advarsel
 * alene for HELT tomme huller.
 *
 * Et hul uden en eneste arbejdsdag (fx en weekend mellem to dagrækker) er ingen mangel og tælles ikke. Er der
 * slet ingen indkomst i perioden, siger «Ingen indkomst i beregningsperioden» det, og der advares ikke oveni.
 */
export const resolveBeregningsperiodeIndkomstHuller = (values: TafCalculationValues): readonly IsoRange[] => {
  if (values.beregnesUdFra !== 'Beregningsperiode') return [];
  const periode = buildBeregningsperiodeRange(values);
  if (periode === undefined) return [];

  const daekket = mergeIsoDateRanges(
    buildIncomeSourceRanges(values).filter((range) => range.fra <= periode.til && range.til >= periode.fra),
    { mergeAdjacent: true },
  );
  if (daekket.length === 0) return [];

  // `daekket` er sorteret og flettet (også tilstødende), så hullerne er netop mellemrummene.
  const huller: IsoRange[] = [];
  let naesteFra = periode.fra;
  for (const range of daekket) {
    if (range.fra > naesteFra) {
      const til = getDayBeforeIso(range.fra);
      huller.push({ fra: naesteFra, til: til < periode.til ? til : periode.til });
    }
    const efter = getDayAfterIso(range.til);
    if (efter > naesteFra) naesteFra = efter;
  }
  if (naesteFra <= periode.til) huller.push({ fra: naesteFra, til: periode.til });

  return huller.filter((hul) => (calculateFerieHverdageMinusSHDage(hul.fra, hul.til) ?? 0) > 0);
};

const formatRange = (range: IsoRange): string =>
  `${isoToDanish(range.fra) ?? range.fra} - ${isoToDanish(range.til) ?? range.til}`;

const joinDanish = (parts: readonly string[]): string =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`;

export const buildBeregningsperiodeIndkomstHullerMessage = (huller: readonly IsoRange[]): string =>
  `Der er hverken angivet løn eller offentlige ydelser for ${joinDanish(huller.map(formatRange))} i beregningsperioden`;
