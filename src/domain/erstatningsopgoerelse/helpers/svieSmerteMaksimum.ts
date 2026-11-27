import { svieSmerteMax } from '../../../data/lovbestemteRates';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { formatCurrency } from '../../../utils/formatUtils';
import { roundKroner } from '../../money/money';
import { parseForligsgrad } from '../engines/forligsgrad';
import { erSvieSmerteTidligereMaxRelevant, erSvieSmerteTidligereTotalRelevant } from './eoInputRelevance';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

/**
 * Maksimum som beregningen faktisk bruger: lovens loft for satsåret, skaleret med en eventuel
 * forligsgrad og afrundet til hele øre – samme tre led som `svieSmerteEngine`
 * (`roundKroner(satsMax * forlig.factor)`). Uden afrundingen er loftet ved brøkforlig (fx 88.500/7 =
 * 12.642,857…) et andet tal end det, der vises og regnes med (12.642,86), og et beløb LIG det viste
 * maksimum meldes som over det.
 *
 * `undefined` når satsåret ikke er brugbart: så findes der ingen grænse at måle et beløb mod.
 */
export const resolveEffektivtSvieSmerteMaksimum = (
  values: ErstatningsopgoerelseValues,
): number | undefined => {
  const aar = values.svieSmerteSatserAar;
  if (typeof aar !== 'number' || !Number.isInteger(aar)) return undefined;
  const satsMax = svieSmerteMax[aar as keyof typeof svieSmerteMax];
  if (!satsMax) return undefined;
  const forligsgrad = parseForligsgrad(values)?.factor;
  return roundKroner(forligsgrad !== undefined ? satsMax * forligsgrad : satsMax);
};

/**
 * Advarselsteksten, når det beløb, der er opgjort i tidligere erstatningsopgørelser, overstiger
 * maksimum – `null` når der ikke er noget at advare om.
 *
 * Beløbet fradrages i rammen (`restPlads = max - tidligere`), så et beløb over maksimum gør hele
 * kravet til 0. Det KAN være rigtigt – rammen kan reelt være opbrugt – og advarslen er derfor gul
 * og ikke-blokerende. Men den skal ses, for papiret trykker grænsen to linjer længere oppe, og
 * feltet tager imod et hvilket som helst beløb.
 *
 * Ét sted, fordi teksten både bæres af rækken i «Fejl og advarsler» og af den gule ring ved feltet;
 * to kopier ville kunne drive fra hinanden.
 */
export const resolveSvieSmerteTidligereTotalOverMaxWarning = (
  values: ErstatningsopgoerelseValues,
): string | null => {
  if (!erSvieSmerteTidligereTotalRelevant(values)) return null;
  const beloeb = amountValueToNumber(values.svieSmerteTidligereTotal);
  if (typeof beloeb !== 'number') return null;
  const maksimum = resolveEffektivtSvieSmerteMaksimum(values);
  if (maksimum === undefined || beloeb <= maksimum) return null;
  return `Svie/smerte opgjort i tidligere erstatningsopgørelser overstiger maksimum (${formatCurrency(maksimum)} kr.)`;
};

/**
 * Maksimum var opbrugt i tidligere erstatningsopgørelser. To veje fører hertil – brugerens afkrydsning
 * «Tidligere beregnet S/S til max.» og motorens `maksimumOpbrugtFoerPerioden`, når et indtastet tidligere
 * beløb æder hele rammen – og de er samme tilstand.
 *
 * Ét prædikat, som både dokumentet («Maksimum for svie- og smertegodtgørelse er nået i tidligere
 * erstatningsopgørelse.») og rækkens «Svie/smerte-ophør skyldes» læser, så de ikke kan give to
 * forskellige grunde for samme indtastning.
 */
export const erSvieSmerteMaksimumOpbrugt = (
  values: Pick<ErstatningsopgoerelseValues, 'kravPaaSvieSmerteGodtgoerelse' | 'tidligereSsMax'>,
  maksimumOpbrugtFoerPerioden: boolean,
): boolean =>
  (erSvieSmerteTidligereMaxRelevant(values) && values.tidligereSsMax === 'Ja') ||
  (values.kravPaaSvieSmerteGodtgoerelse === 'Ja' && values.tidligereSsMax === 'Nej' && maksimumOpbrugtFoerPerioden);
