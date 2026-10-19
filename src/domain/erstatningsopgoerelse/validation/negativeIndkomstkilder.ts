import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { formatAsAmount } from '../../../utils/formatUtils';
import {
  buildBeregningsperiodeRange,
  buildIncomeForRangesDetailed,
  buildTafRanges,
  resolveAnsaettelsesforholdNavn,
  type IncomeNegativeSource,
} from '../helpers/indtaegtPerioder';

// En indtægtskilde, hvis rækker SAMLET er negative i beregningsperioden eller erstatningsperioden (BB-290).
//
// Negative rækker regnes med og modregnes i kildens øvrige indtægt (udviklerafgørelse 2026-10-19). Er kildens
// samlede indtægt i en periode negativ, er der intet at modregne i: lønudviklingen kan ikke regulere en negativ
// basisløn, og et negativt fradrag ville forhøje kravet ud over det fulde tab. Indtil udvikleren har afgjort,
// hvordan det skal regnes, spærrer opgørelsen fail-closed med en navngiven linje – i stedet for at kilden
// forsvinder tavst eller beregningen ender i en intern undtagelse.

export type NegativIndkomstkildeFund = Readonly<{
  source: IncomeNegativeSource;
  periode: 'beregningsperioden' | 'erstatningsperioden';
  message: string;
}>;

const formatKroner = (amount: number): string => `${formatAsAmount(amount, 2)} kr.`;

const buildMessage = (source: IncomeNegativeSource, periode: NegativIndkomstkildeFund['periode']): string =>
  source.kind === 'employer'
    ? `Lønnen fra ${resolveAnsaettelsesforholdNavn(source.name, source.index)} er samlet negativ i ${periode} `
      + `(${formatKroner(source.amount)}). En samlet negativ løn kan ikke indgå i beregningen – kontrollér lønrækkerne`
    : `${source.label} er samlet negativ i ${periode} (${formatKroner(source.amount)}). En samlet negativ ydelse `
      + 'kan ikke indgå i beregningen – kontrollér ydelsesrækkerne';

/** Kilderne med samlet negativ indtægt – i beregningsperioden (ved «Beregningsperiode») og i erstatningsperioden. */
export const resolveNegativeIndkomstkilder = (
  values: ErstatningsopgoerelseValues,
  skadedato: ISODateString | undefined
): readonly NegativIndkomstkildeFund[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];
  const fund: NegativIndkomstkildeFund[] = [];
  const beregningsperiode = values.beregnesUdFra === 'Beregningsperiode' ? buildBeregningsperiodeRange(values) : null;
  if (beregningsperiode) {
    for (const source of buildIncomeForRangesDetailed(values, [beregningsperiode], undefined, skadedato).negativeSources) {
      fund.push({ source, periode: 'beregningsperioden', message: buildMessage(source, 'beregningsperioden') });
    }
  }
  const tafRanges = buildTafRanges(values, { skadedatoISO: skadedato });
  if (tafRanges.length > 0) {
    for (const source of buildIncomeForRangesDetailed(values, tafRanges, undefined, skadedato).negativeSources) {
      fund.push({ source, periode: 'erstatningsperioden', message: buildMessage(source, 'erstatningsperioden') });
    }
  }
  return fund;
};
