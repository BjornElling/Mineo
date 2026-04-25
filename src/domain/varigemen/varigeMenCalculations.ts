import type { VarigeMenValues } from '../../schemas/formSchemas';
import type { YearlyRate } from '../../data/lovbestemteRates';
import { coerceToDanishDateString, coerceToISODateString, parseISODate, type ISODateString } from '../../types/branded';
import { calculateUtcAgeInWholeYears, parseDanishDate } from '../../utils/dateUtils';
import { roundByMethod } from '../../utils/rounding';

const getRateForYear = (dict: YearlyRate, year: number): number | undefined => {
  if (!Object.prototype.hasOwnProperty.call(dict, year)) return undefined;
  return dict[year];
};

export type MenSatsForAar = Readonly<{ aar: number; sats: number }>;

export function resolveMenSatsForBeregningsdato(
  beregningsdato: ISODateString | undefined,
  rates: YearlyRate
): MenSatsForAar | undefined {
  if (!beregningsdato) return undefined;
  const d = parseISODate(beregningsdato);
  if (!d) return undefined;
  const aar = d.getUTCFullYear();
  const sats = getRateForYear(rates, aar);
  if (sats === undefined) return undefined;
  return { aar, sats };
}

/**
 * Beregn aldersfradrag i procent efter lovens ordlyd
 *
 * Regler:
 * - 40–69 år: 1 % pr. år over 39 (maks 30 %)
 * - 60–69 år: yderligere 1 % pr. år over 59 (maks 10 % ekstra)
 * - Intet yderligere fradrag efter 69 år
 * - Total maksimum: 40 % (ved 69+ år)
 *
 * @param alderVedSkade - Alder i hele år på skadestidspunktet
 * @returns Fradrag i hele procent (0–40)
 */
function beregnAldersfradragPct(alderVedSkade: number): number {
  if (!Number.isFinite(alderVedSkade) || alderVedSkade <= 39) {
    return 0;
  }

  // Basis: 1% pr. år over 39, maks til og med 69 år (maks 30%)
  const basisFradrag = Math.min(30, Math.max(0, alderVedSkade - 39));

  // Ekstra: yderligere 1% pr. år over 59, maks til og med 69 år (maks 10%)
  const ekstraFradrag =
    alderVedSkade > 59
      ? Math.min(10, Math.max(0, alderVedSkade - 59))
      : 0;

  return basisFradrag + ekstraFradrag;
}

/**
 * Resultat af ménberegning med mellemregninger
 */
export type VarigeMenBeregningResult = {
  beregnetGodtgoerelse: number;
  grundbeloeb: number;
  satsPerMengrad: number;
  aldersreduktionPct: number;
  grundbeloebUdenReduktion: number;
  alderVedSkade: number;
};

/**
 * Regnefunktion for varige mén-godtgørelse
 *
 * Regler:
 * - Grundbeløb findes ud fra Beregningsdato (rate lookup)
 * - Méngrad anvendes direkte som heltal (ingen afrunding)
 * - Godtgørelse = (grundbeløb * méngrad / 100)
 * - Aldersfradrag beregnes ud fra alder ved skadestidspunktet
 * - Slutbeløb afrundes altid OP til nærmeste hele krone
 *
 * @param values - Validerede inputværdier fra varigemen-formularen
 * @param skadestidspunktRaw - ISO-dato for skadestidspunktet (fx '2012-05-01')
 * @returns Godtgørelsesbeløb i kroner eller 'Indtastninger mangler'
 */
const roundMenAmount = (value: number): number => {
  // Afrund altid OP til nærmeste hele krone.
  return roundByMethod(value, 0, 'ceil');
};

export function beregnVarigeMenGodtgoerelseWithRates(
  values: VarigeMenValues,
  skadestidspunktRaw: ISODateString | undefined,
  rates: YearlyRate,
  fodselsdatoFromStamdata: ISODateString | undefined
): VarigeMenBeregningResult | null {
  // --- Input check ---
  const mengrad = values.mengrad;
  const beregningsdatoRaw = values.beregningsdato;
  const fodselsdatoRaw = fodselsdatoFromStamdata;

  if (
    typeof mengrad !== 'number' ||
    !Number.isFinite(mengrad) ||
    mengrad <= 0 ||
    mengrad > 100 ||
    !beregningsdatoRaw ||
    !fodselsdatoRaw
  ) {
    return null;
  }

  const skadestidspunktISO = skadestidspunktRaw;
  if (!skadestidspunktISO) return null;

  // --- Rate lookup (beregningsdato) ---
  const beregningsdatoDanish = coerceToDanishDateString(beregningsdatoRaw);
  if (!beregningsdatoDanish) return null;

  const beregningsdato = parseDanishDate(beregningsdatoDanish);
  if (!beregningsdato) return null;

  const beregningsaar = beregningsdato.getUTCFullYear();
  const satsPerMengrad = getRateForYear(rates, beregningsaar);
  if (satsPerMengrad === undefined) return null;
  if (typeof satsPerMengrad !== 'number' || !Number.isFinite(satsPerMengrad) || satsPerMengrad < 0) {
    return null;
  }

  // `satsPerMengrad` er lovsats pr. méntrin; grundbeløbet ved 100% méngrad er derfor sats * 100.
  const grundbeloeb = satsPerMengrad * 100;

  // --- Alder ved skadestidspunkt ---
  const fodselsdatoISO = coerceToISODateString(fodselsdatoRaw);
  if (!fodselsdatoISO) return null;

  const fodselsdato = parseISODate(fodselsdatoISO);
  const skadestidspunkt = parseISODate(skadestidspunktISO);
  if (!fodselsdato || !skadestidspunkt) return null;

  const alderVedSkade = calculateUtcAgeInWholeYears(fodselsdato, skadestidspunkt);
  if (alderVedSkade === undefined) return null;

  const fradragsPct = beregnAldersfradragPct(alderVedSkade);

  // --- Beregning ---
  const grundbeloebUdenReduktion = satsPerMengrad * mengrad;

  let godtgorelse = grundbeloebUdenReduktion;

  if (fradragsPct > 0) {
    godtgorelse = godtgorelse * (1 - fradragsPct / 100);
  }

  // Afrund altid OP til nærmeste hele krone
  return {
    beregnetGodtgoerelse: roundMenAmount(godtgorelse),
    grundbeloeb,
    satsPerMengrad,
    aldersreduktionPct: fradragsPct,
    grundbeloebUdenReduktion,
    alderVedSkade,
  };
}
