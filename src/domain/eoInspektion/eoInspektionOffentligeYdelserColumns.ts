import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, dateToISO } from '../../types/branded';
import { parseAmount } from '../../utils/numberParsing';
import { resolveYdelsestype, ydelsestyper, type Periodisering } from '../../data/ydelsestyper';
import { isoDateToDate } from '../dates/isoDate';
import {
  buildOffentligYdelsePeriodiseringsGrundlag,
  isOffentligYdelseDatoMedregnet as isOffentligYdelseDatoMedregnetCentral,
} from '../erstatningsopgoerelse/engines/periodiseringsMotor';
import { iterateDatesInclusive, validateIsoRange } from '../../utils/isoDateHelpers';

export type OffentligYdelseCoreColumn = Readonly<{
  typeKey: string;
  header: string;
  /** Ydelsens navn uden `tabelLabel`s linjeskift (CSV-filens kolonnenavn). */
  name: string;
  amountsByIndex: Float64Array;
}>;

// LOCKED: Offentlige ydelser kontrol-clusteret er færdig‑porteret.
// Ændr kun ved parity‑brud og dokumentér årsag.
export const parseOffentligDato = (value: string | undefined): ISODateString | undefined => {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return undefined;
  return coerceToISODateString(trimmed);
};

const isOffentligYdelseDatoMedregnet = (
  iso: ISODateString,
  dateObj: Date,
  shDays: ReadonlySet<ISODateString>,
  periodisering: Periodisering,
  ydelsestypeKey: string,
  rowTilISO: ISODateString,
  sygedagpengeShCutoff: ISODateString
): boolean => {
  return isOffentligYdelseDatoMedregnetCentral({
    iso,
    dateObj,
    shDays,
    periodisering,
    ydelsestypeKey,
    rowTilISO,
    sygedagpengeShCutoff,
  });
};

export const buildOffentligeYdelserColumns = (args: {
  dates: readonly ISODateString[];
  isoIndex: ReadonlyMap<ISODateString, number>;
  values: ErstatningsopgoerelseValues;
  shDays: ReadonlySet<ISODateString>;
  sygedagpengeShCutoff: ISODateString;
  errorRowIds: ReadonlySet<string>;
}): Readonly<{
  columns: ReadonlyArray<OffentligYdelseCoreColumn>;
}> => {
  const { dates, isoIndex, values, shDays, sygedagpengeShCutoff, errorRowIds } = args;

  const byType = new Map<string, Float64Array>();
  const typeOrder: string[] = [];

  for (const row of values.offentligeYdelserRows ?? []) {
    if (errorRowIds.has(row.id)) continue;
    const rawType = row.ydelsestype?.trim() ?? '';
    if (rawType === '') continue;
    // Samme kanoniske opslag som indtægtssiden bruger. Et direkte `ydelsestyper[rawType]` ville
    // ikke forstå en gemt LABEL («Sygedagpenge»), og kolonnen ville udeblive, mens indtægtssiden
    // regnede videre – netop den asymmetri, der meldte en falsk `control:sammentaelling_mismatch`.
    const resolved = resolveYdelsestype(rawType);
    if (!resolved) continue;
    const typeKey = resolved.key;
    const config = resolved.config;

    const fraISO = parseOffentligDato(row.fraDato);
    const tilISO = parseOffentligDato(row.tilDato);
    const range = validateIsoRange(fraISO, tilISO);
    if (!range) continue;

    const total = parseAmount(row.ydelse) + parseAmount(row.tillaeg);
    if (total === 0) continue;

    const start = isoDateToDate(range.fra);
    const end = isoDateToDate(range.til);
    const periodiseringsGrundlag = buildOffentligYdelsePeriodiseringsGrundlag({
      interval: { start, end },
      periodisering: config.periodisering,
      ydelsestypeKey: typeKey,
      shDays,
      sygedagpengeShCutoff,
    });
    if (!periodiseringsGrundlag || periodiseringsGrundlag.periodiseringsDage <= 0) continue;
    const dayCount = periodiseringsGrundlag.periodiseringsDage;

    let amounts = byType.get(typeKey);
    if (!amounts) {
      // NOTE: Float64Array er bevidst valgt for deterministisk summation.
      amounts = new Float64Array(dates.length);
      byType.set(typeKey, amounts);
      typeOrder.push(typeKey);
    }

    const perDay = total / dayCount;
    iterateDatesInclusive(start, end, (d) => {
      const iso = dateToISO(d);
      if (!iso) return;
      const idx = isoIndex.get(iso);
      if (idx === undefined) return;
      if (
        periodiseringsGrundlag.fallbackAllocationDays
          ? !periodiseringsGrundlag.fallbackAllocationDays.has(iso)
          : !isOffentligYdelseDatoMedregnet(iso, d, shDays, config.periodisering, typeKey, range.til, sygedagpengeShCutoff)
      ) return;
      amounts[idx] += perDay;
    });
  }

  const columns = typeOrder.map((typeKey) => {
    const config = ydelsestyper[typeKey];
    const name = config?.label ?? typeKey;
    const header = config?.tabelLabel ?? name;
    const amountsByIndex = byType.get(typeKey) ?? new Float64Array(dates.length);
    return { typeKey, header, name, amountsByIndex };
  });

  return { columns };
};
