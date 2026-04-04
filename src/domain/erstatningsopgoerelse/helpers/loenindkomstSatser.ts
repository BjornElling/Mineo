import type {
  LoenindkomstAnsaettelsesforhold,
  LoenudviklingManuelRow,
} from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish, parseISODate, toDanishDateString } from '../../../types/branded';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  isOffentligOverenskomstId,
  resolveOverenskomstRef,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { STORE_BEDEDAG_PCT } from '../../../config/regulatoryRates';
import { STORE_BEDEDAG_START } from '../../../config/dateRanges';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import type { StandardLoenRateSegment, StandardLoenSatserInput } from '../../aarsloen/standardLoenRowCalculations';
import { dateToISO } from '../../../types/branded';
import { addDays } from '../../../utils/dateUtils';

type OverenskomstSatserResult = Readonly<{
  fritvalgPct?: number;
  shSoPct?: number;
  pensionPct?: number;
}>;

type AutoSatsFields = Pick<
  LoenindkomstAnsaettelsesforhold,
  'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
>;

const toPctPoint = (value: number | null | undefined): number | undefined => (
  typeof value === 'number' ? value * 100 : undefined
);

const resolveStoreBededagPct = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'loenPaaHelligdage'>,
  reguleringsDato: ISODateString | undefined
): number => {
  if (!reguleringsDato) return 0;
  return af.loenPaaHelligdage === 'Almindelig løn' && reguleringsDato >= STORE_BEDEDAG_START
    ? STORE_BEDEDAG_PCT
    : 0;
};

const resolveManualPercentValue = (
  rowValue: string | undefined,
  fallback: number | undefined
): number | undefined => {
  if (typeof rowValue === 'string' && rowValue.trim() !== '') {
    return parsePercentToDecimal(rowValue) * 100;
  }
  return fallback;
};

const buildSegmentsFromPeriodStarts = (
  fra: ISODateString,
  til: ISODateString,
  starts: readonly ISODateString[]
): readonly Readonly<{ fra: ISODateString; til: ISODateString; startDato: ISODateString }>[] => {
  const boundedStarts = Array.from(new Set([fra, ...starts.filter((start) => start >= fra && start <= til)])).sort();
  return boundedStarts.map((startDato, index) => {
    const nextStart = boundedStarts[index + 1];
    const nextStartDate = nextStart ? parseISODate(nextStart) : null;
    const tilDato = nextStartDate ? dateToISO(addDays(nextStartDate, -1)) : til;
    return {
      fra: startDato,
      til: tilDato && tilDato < til ? tilDato : til,
      startDato,
    };
  }).filter((segment) => segment.fra <= segment.til);
};

const resolvePeriodSatser = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'overenskomstId' | 'loenPaaHelligdage'>,
  fraDa: ReturnType<typeof toDanishDateString>,
  tilDa: ReturnType<typeof toDanishDateString>
): readonly OverenskomstPeriodeSats[] => {
  const overenskomstId = af.overenskomstId?.trim();
  if (!overenskomstId) return [];
  const applyShRegel = af.loenPaaHelligdage === 'Almindelig løn';
  if (isOffentligOverenskomstId(overenskomstId)) {
    return getOffentligTillaegsSatserForPeriode(overenskomstId, fraDa, tilDa, applyShRegel);
  }
  const ref = resolveOverenskomstRef(overenskomstId);
  if (!ref) return [];
  return getEffektiveSatserForPeriode({
    overenskomstId: ref.baseId,
    fraDato: fraDa,
    tilDato: tilDa,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
  });
};

export const resolveLoenindkomstReguleringsdato = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'saerligFraDatoRegulering'>,
  skadesdato: ISODateString | undefined
): ISODateString | undefined => af.saerligFraDatoRegulering || skadesdato;

export const resolveAutoStoreBededagPct = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'loenPaaHelligdage' | 'saerligFraDatoRegulering'>,
  skadesdato: ISODateString | undefined
): number => resolveStoreBededagPct(af, resolveLoenindkomstReguleringsdato(af, skadesdato));

export const resolveOverenskomstAutoSatser = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'saerligFraDatoRegulering' | 'loenPaaHelligdage'>,
  skadesdato: ISODateString | undefined
): OverenskomstSatserResult => {
  if (!af.harOverenskomst) return {};
  const overenskomstId = af.overenskomstId?.trim();
  const reguleringsDato = resolveLoenindkomstReguleringsdato(af, skadesdato);
  if (!overenskomstId || !reguleringsDato) return {};
  const dato = isoToDanish(reguleringsDato);
  if (!dato) return {};

  const applyShRegel = af.loenPaaHelligdage === 'Almindelig løn';
  const satser = isOffentligOverenskomstId(overenskomstId)
    ? getOffentligTillaegsSatserForDato(overenskomstId, dato, applyShRegel)
    : (() => {
      const ref = resolveOverenskomstRef(overenskomstId);
      if (!ref) return undefined;
      return getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato,
        applyAlmindeligLoenPaaShDageRegel: applyShRegel,
      });
    })();

  if (!satser) return {};
  return {
    fritvalgPct: toPctPoint(satser.fritvalg),
    shSoPct: toPctPoint(satser.shSoSats),
    pensionPct: toPctPoint(satser.agPension),
  };
};

export const hasLockedOverenskomstSatser = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): boolean => af.harOverenskomst && Boolean(af.overenskomstId?.trim());

export const resolveAutoSatsFields = (
  af: Pick<
    LoenindkomstAnsaettelsesforhold,
    'harOverenskomst' | 'overenskomstId' | 'saerligFraDatoRegulering' | 'loenPaaHelligdage'
    | 'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
  >,
  skadesdato: ISODateString | undefined
): AutoSatsFields => {
  const autoStoreBededag = resolveAutoStoreBededagPct(af, skadesdato);
  const autoSatser = resolveOverenskomstAutoSatser(af, skadesdato);

  return {
    fritvalgPct: autoSatser.fritvalgPct ?? af.fritvalgPct,
    shSoPct: autoSatser.shSoPct ?? af.shSoPct,
    storeBededagPct: autoStoreBededag,
    pensionPct: autoSatser.pensionPct ?? af.pensionPct,
  };
};

export const applyAutoSatsFields = <
  T extends Pick<
    LoenindkomstAnsaettelsesforhold,
    'harOverenskomst' | 'overenskomstId' | 'saerligFraDatoRegulering' | 'loenPaaHelligdage'
    | 'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
  >,
>(
  af: T,
  skadesdato: ISODateString | undefined
): T => ({
  ...af,
  ...resolveAutoSatsFields(af, skadesdato),
});

export const buildLoenindkomstRateSegments = (args: Readonly<{
  ansaettelsesforhold: Pick<
    LoenindkomstAnsaettelsesforhold,
    | 'feriePct'
    | 'fritvalgPct'
    | 'shSoPct'
    | 'storeBededagPct'
    | 'pensionPct'
    | 'loenudviklingBeregningsgrundlag'
    | 'loenudviklingManuelTableData'
    | 'harOverenskomst'
    | 'overenskomstId'
    | 'loenPaaHelligdage'
    | 'saerligFraDatoRegulering'
  >;
  skadesdato: ISODateString | undefined;
  fra: ISODateString;
  til: ISODateString;
}>): readonly StandardLoenRateSegment[] => {
  const { ansaettelsesforhold: af, skadesdato: _skadesdato, fra, til } = args;
  const baseSatser: StandardLoenSatserInput = {
    feriePct: af.feriePct,
    fritvalgPct: af.fritvalgPct,
    shSoPct: af.shSoPct,
    storeBededagPct: af.storeBededagPct,
    pensionPct: af.pensionPct,
  };

  if (af.loenudviklingBeregningsgrundlag === 'Manuelt angivet') {
    const rows = (af.loenudviklingManuelTableData ?? [])
      .filter((row): row is LoenudviklingManuelRow => typeof row.dato === 'string' && row.dato.trim() !== '')
      .map((row) => ({ row, startDato: row.dato! as ISODateString }))
      .filter((entry) => entry.startDato >= fra && entry.startDato <= til)
      .sort((left, right) => left.startDato.localeCompare(right.startDato));
    const starts = rows.map((entry) => entry.startDato);
    return buildSegmentsFromPeriodStarts(fra, til, starts).map((segment) => {
      const row = rows.find((entry) => entry.startDato === segment.startDato)?.row;
      return {
        fra: segment.fra,
        til: segment.til,
        satser: {
          feriePct: resolveManualPercentValue(row?.feriepenge, af.feriePct),
          fritvalgPct: resolveManualPercentValue(row?.fritvalg, af.fritvalgPct),
          shSoPct: resolveManualPercentValue(row?.shSoSats, af.shSoPct),
          storeBededagPct: resolveStoreBededagPct(af, segment.startDato),
          pensionPct: resolveManualPercentValue(row?.agPension, af.pensionPct),
        },
      };
    });
  }

  if (!af.harOverenskomst || !af.overenskomstId?.trim()) {
    return [{ fra, til, satser: baseSatser }];
  }

  const fraDa = isoToDanish(fra);
  const tilDa = isoToDanish(til);
  if (!fraDa || !tilDa) {
    return [{ fra, til, satser: baseSatser }];
  }

  const periodSatser = resolvePeriodSatser(af, fraDa, tilDa);
  const starts = periodSatser
      .map((sats) => sats.fraDato.split('-').reverse().join('-') as ISODateString)
    .filter((start) => start >= fra && start <= til);

  return buildSegmentsFromPeriodStarts(fra, til, starts).map((segment) => {
    const dato = isoToDanish(segment.startDato);
    if (!dato) {
      return { fra: segment.fra, til: segment.til, satser: baseSatser };
    }
    const auto = resolveOverenskomstAutoSatser(af, segment.startDato);
    return {
      fra: segment.fra,
      til: segment.til,
      satser: {
        feriePct: af.feriePct,
        fritvalgPct: auto.fritvalgPct ?? af.fritvalgPct,
        shSoPct: auto.shSoPct ?? af.shSoPct,
        storeBededagPct: resolveStoreBededagPct(af, segment.startDato),
        pensionPct: auto.pensionPct ?? af.pensionPct,
      },
    };
  });
};
