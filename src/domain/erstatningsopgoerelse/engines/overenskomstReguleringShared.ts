import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import {
  getEffektiveSatserForDato,
  getReguleringsDatoIntervalForOverenskomst,
  type OverenskomstId,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { STORE_BEDEDAG_PCT } from '../../../config/regulatoryRates';
import { STORE_BEDEDAG_START } from '../../../config/dateRanges';
import { resolvePctPointFromSatsOrInput } from '../helpers/eoSharedUtils';
import type { FormulaComponents } from './reguleringFormulaUtils';

type PrivateOverenskomstBaseArgs = Readonly<{
  overenskomstId: OverenskomstId;
  anvendtReguleringsdato: ISODateString;
  effectiveReguleringsdato: ISODateString;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  shSoPctInput: number | undefined;
  fritvalgPctInput: number | undefined;
  pensionPctInput: number | undefined;
}>;

export type PrivateOverenskomstBaseContext = Readonly<{
  effectiveBase: Readonly<{
    startIso: ISODateString;
    sats: OverenskomstPeriodeSats;
  }>;
  referenceSats: OverenskomstPeriodeSats | undefined;
  useInputPctBasisForMissingBase: boolean;
}>;

const hasNonZeroDefinedPct = (value: number | undefined): boolean =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > 0.000001;

export const resolvePrivateOverenskomstBaseContext = (
  args: PrivateOverenskomstBaseArgs
): PrivateOverenskomstBaseContext | null => {
  const anvendtDatoDa = isoToDanish(args.anvendtReguleringsdato);
  const effectiveDatoDa = isoToDanish(args.effectiveReguleringsdato);
  if (!effectiveDatoDa) return null;

  const referenceSats = anvendtDatoDa
    ? getEffektiveSatserForDato({
        overenskomstId: args.overenskomstId,
        dato: anvendtDatoDa,
        applyAlmindeligLoenPaaShDageRegel: args.applyAlmindeligLoenPaaShDageRegel,
      })
    : undefined;

  const effectiveSats = getEffektiveSatserForDato({
    overenskomstId: args.overenskomstId,
    dato: effectiveDatoDa,
    applyAlmindeligLoenPaaShDageRegel: args.applyAlmindeligLoenPaaShDageRegel,
  });

  const effectiveBase = (() => {
    if (effectiveSats) {
      return {
        startIso: args.effectiveReguleringsdato,
        sats: effectiveSats,
      };
    }
    const interval = getReguleringsDatoIntervalForOverenskomst(args.overenskomstId);
    if (!interval) return null;
    const firstStartIso = interval.fraDato.split('-').reverse().join('-') as ISODateString;
    const firstSats = getEffektiveSatserForDato({
      overenskomstId: args.overenskomstId,
      dato: interval.fraDato,
      applyAlmindeligLoenPaaShDageRegel: args.applyAlmindeligLoenPaaShDageRegel,
    });
    if (!firstSats) return null;
    return {
      startIso: firstStartIso,
      sats: firstSats,
    };
  })();

  if (!effectiveBase) return null;

  return {
    effectiveBase,
    referenceSats,
    useInputPctBasisForMissingBase: (
      args.anvendtReguleringsdato < args.effectiveReguleringsdato
      || !referenceSats
    ) && (
      hasNonZeroDefinedPct(args.shSoPctInput)
      || hasNonZeroDefinedPct(args.fritvalgPctInput)
      || hasNonZeroDefinedPct(args.pensionPctInput)
    ),
  };
};

export const buildPrivateOverenskomstFormulaComponents = (args: Readonly<{
  sats: OverenskomstPeriodeSats;
  context: PrivateOverenskomstBaseContext;
  feriePct: number;
  shSoPctInput: number | undefined;
  fritvalgPctInput: number | undefined;
  pensionPctInput: number | undefined;
  pctBasisRole: 'reference' | 'segment';
  dateIso: ISODateString;
  baseValueSupplement?: number;
  applyAlmindeligLoenPaaShDageRegel: boolean;
}>): FormulaComponents => ({
  baseValue: (args.sats.grundloen ?? 0) + (args.baseValueSupplement ?? 0),
  feriePct: args.feriePct,
  fritvalgPct: args.context.useInputPctBasisForMissingBase && args.pctBasisRole === 'reference'
    ? resolvePctPointFromSatsOrInput(args.context.referenceSats?.fritvalg, args.fritvalgPctInput)
    : resolvePctPointFromSatsOrInput(args.sats.fritvalg, args.fritvalgPctInput),
  shSoPct: args.context.useInputPctBasisForMissingBase && args.pctBasisRole === 'reference'
    ? resolvePctPointFromSatsOrInput(args.context.referenceSats?.shSoSats, args.shSoPctInput)
    : resolvePctPointFromSatsOrInput(args.sats.shSoSats, args.shSoPctInput),
  pensionPct: args.context.useInputPctBasisForMissingBase && args.pctBasisRole === 'reference'
    ? resolvePctPointFromSatsOrInput(args.context.referenceSats?.agPension, args.pensionPctInput)
    : resolvePctPointFromSatsOrInput(args.sats.agPension, args.pensionPctInput),
  storeBededagPct: args.applyAlmindeligLoenPaaShDageRegel && args.dateIso >= STORE_BEDEDAG_START
    ? STORE_BEDEDAG_PCT
    : 0,
});
