import { svieSmerteMax } from '../../../data/lovbestemteRates';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { formatCurrency } from '../../../utils/formatUtils';
import { parseForligsgrad } from '../engines/forligsgrad';
import { erSvieSmerteTidligereTotalRelevant } from './eoInputRelevance';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

/**
 * Maksimum som beregningen faktisk bruger: lovens loft for satsåret, skaleret med en eventuel
 * forligsgrad – samme to led som `svieSmerteEngine` (`satsMax * forlig.factor`).
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
  return forligsgrad !== undefined ? satsMax * forligsgrad : satsMax;
};

/**
 * Advarselsteksten, når det beløb, der er opgjort i tidligere erstatningsopgørelser, overstiger
 * maksimum – `null` når der ikke er noget at advare om.
 *
 * Beløbet fradrages i rammen (`restPlads = max - tidligere`), så et beløb over maksimum gør hele
 * kravet til 0. Det KAN være rigtigt – rammen kan reelt være opbrugt – og advarslen er derfor gul
 * og ikke-blokerende. Men den skal ses, for papiret trykker grænsen to linjer længere oppe, og
 * feltet tog før imod et hvilket som helst beløb uden en markering (BB-219).
 *
 * Ét sted, fordi teksten både bæres af rækken i «Fejl og advarsler» og af den gule ring ved feltet;
 * to kopier ville kunne drive fra hinanden (BB-207's lære).
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
