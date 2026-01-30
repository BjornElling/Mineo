/**
 * Loen Core Model
 *
 * SCOPE:
 * - Byg grundloenspakke pr. dag (arbejdsdage + EO-periode)
 * - Byg svie/smerte pr. dag (kalenderdage, separat)
 * - Ingen UI-viden
 * - Ingen parsing i UI
 */

import type { ISODateString, DanishDateString } from '../../types/branded';
import { isoToDanish, toISODateString } from '../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues, LoenPaaHelligdage } from '../../types/common';
import { LOEN_PAA_HELLIGDAGE } from '../../types/common';
import type { DebugDay } from './eoDebugTypes';
import type { LoenTimeline, DailyLoen, LoenComponent, DailySvieSmerte } from './eoDebugLoenTypes';
import { getEffektiveSatserForDato, resolveOverenskomstRef } from '../../data/overenskomstRates';
import { parsePercentToDecimal } from '../../utils/formatUtils';
import { svieSmertePrDag } from '../../data/regulationRates';

const STORE_BEDEDAG_PCT = 0.0045;
const STORE_BEDEDAG_START = '2024-01-01';

/**
 * Loen Core Input
 */
export type LoenCoreInput = Readonly<{
  debugDays: readonly DebugDay[];
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
}>;

const parseOptionalIso = (value: unknown): ISODateString | undefined => {
  if (!value || typeof value !== 'string' || value.trim() === '') return undefined;
  try {
    return toISODateString(value);
  } catch {
    return undefined;
  }
};

const getEoRange = (
  values: ErstatningsopgoerelseValues
): { fra: ISODateString; til: ISODateString } | undefined => {
  const fra = parseOptionalIso(values.vedroererPeriodeFra);
  const til = parseOptionalIso(values.vedroererPeriodeTil);
  if (!fra || !til) return undefined;
  if (fra > til) return undefined;
  return { fra, til };
};

const toDanishOrUndefined = (iso: ISODateString): DanishDateString | undefined => {
  return isoToDanish(iso) ?? undefined;
};

const getPrimaryAnsaettelsesforhold = (
  values: ErstatningsopgoerelseValues
) => values.loenindkomstAnsaettelsesforhold?.[0];

const getStoreBededagPct = (iso: ISODateString, loenPaaHelligdage: LoenPaaHelligdage | undefined): number => {
  if (loenPaaHelligdage !== LOEN_PAA_HELLIGDAGE.ALMINDELIG) return 0;
  return iso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
};

const buildLoenComponents = (args: {
  grundloen: number;
  feriePct: number;
  shSoPct: number;
  fritvalgPct: number;
  storeBededagPct: number;
  pensionPct: number;
}): { components: LoenComponent[]; total: number } => {
  const { grundloen, feriePct, shSoPct, fritvalgPct, storeBededagPct, pensionPct } = args;
  const totalPct = feriePct + shSoPct + fritvalgPct + storeBededagPct;

  const feriegodtgorelse = grundloen * feriePct;
  const shSo = grundloen * shSoPct;
  const fritvalg = grundloen * fritvalgPct;
  const storeBededag = grundloen * storeBededagPct;
  const pension = grundloen * (1 + totalPct) * pensionPct;

  const components: LoenComponent[] = [
    { type: 'grundloen', amount: grundloen, source: 'overenskomst' },
  ];
  if (feriegodtgorelse !== 0) components.push({ type: 'feriegodtgorelse', amount: feriegodtgorelse, source: 'manuel' });
  if (fritvalg !== 0) components.push({ type: 'fritvalg', amount: fritvalg, source: 'overenskomst' });
  if (shSo !== 0) components.push({ type: 'shSo', amount: shSo, source: 'overenskomst' });
  if (storeBededag !== 0) components.push({ type: 'storeBededag', amount: storeBededag, source: 'regel' });
  if (pension !== 0) components.push({ type: 'pension', amount: pension, source: 'overenskomst' });

  const total = components.reduce((sum, c) => sum + c.amount, 0);
  return { components, total };
};

const resolveSvieSmerteSats = (values: ErstatningsopgoerelseValues): number | undefined => {
  const yearValue = values.svieSmerteSatserAar;
  const year = typeof yearValue === 'number' ? yearValue : Number(yearValue);
  if (!Number.isFinite(year)) return undefined;
  return svieSmertePrDag[year];
};

/**
 * Byg loen timeline (grundloenspakke + svie/smerte)
 */
export function buildLoenTimeline(input: LoenCoreInput): LoenTimeline {
  const eoRange = getEoRange(input.eoValues);
  const af = getPrimaryAnsaettelsesforhold(input.eoValues);
  const loenDays: DailyLoen[] = [];
  const svieSmerteDays: DailySvieSmerte[] = [];

  const feriePct = parsePercentToDecimal(af?.feriePct);
  const loenPaaHelligdage = af?.loenPaaHelligdage;

  for (const debugDay of input.debugDays) {
    // Svie/smerte: kalenderdage, separat
    if (debugDay.svieSmerte !== 'Ingen') {
      const baseSats = resolveSvieSmerteSats(input.eoValues);
      if (baseSats !== undefined && baseSats > 0) {
        const delvisMode = input.eoValues.svieSmerteDelvisSygemeldingSats;
        const amount =
          debugDay.svieSmerte === 'Delvis' && delvisMode === 'halv' ? baseSats / 2 : baseSats;
        svieSmerteDays.push({
          iso: debugDay.iso,
          niveau: debugDay.svieSmerte,
          amount,
        });
      }
    }

    // Grundloenspakke: arbejdsdage inden for EO-periode
    if (!debugDay.isArbejdsdag || !eoRange) continue;
    if (debugDay.iso < eoRange.fra || debugDay.iso > eoRange.til) continue;
    if (!af?.overenskomstId) continue;

    const danishDate = toDanishOrUndefined(debugDay.iso);
    if (!danishDate) continue;

    const ref = resolveOverenskomstRef(af.overenskomstId);
    if (!ref) continue;

    const sats = getEffektiveSatserForDato({
      overenskomstId: ref.baseId,
      dato: danishDate,
      applyAlmindeligLoenPaaShDageRegel: loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    });
    if (!sats || sats.grundloen === null) continue;

    const shSoPct = sats.shSoSats ?? 0;
    const fritvalgPct = sats.fritvalg ?? 0;
    const pensionPct = sats.agPension ?? 0;
    const storeBededagPct = getStoreBededagPct(debugDay.iso, loenPaaHelligdage);

    const { components, total } = buildLoenComponents({
      grundloen: sats.grundloen,
      feriePct,
      shSoPct,
      fritvalgPct,
      storeBededagPct,
      pensionPct,
    });

    if (components.length === 0) continue;
    loenDays.push({
      iso: debugDay.iso,
      components,
      dailyTotal: total,
    });
  }

  return { loenDays, svieSmerteDays };
}
