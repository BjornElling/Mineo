import fs from 'node:fs';
import path from 'node:path';
import {
  kapitaliseringsbekendtgoerelser,
  eetKapitaliseringsDatoMaxFraBekendtgoerelser,
} from '../../data/kapitalisering/kapitaliseringsbekendtgoerelser';
import { dateToISO, parseISODate, toISODateString } from '../../types/branded';
import { addDays } from '../../utils/dateUtils';

const resolveIdForDatoer = (
  skadedato: string,
  kapitaliseringsdato: string
): string | undefined => {
  const skadesinterval = kapitaliseringsbekendtgoerelser
    .filter((interval) => interval.skadedatoFra <= skadedato)
    .reduce((latest, current) =>
      current.skadedatoFra > latest.skadedatoFra ? current : latest
    );

  const kandidat = skadesinterval.kapitaliseringer
    .filter((entry) => entry.kapitaliseringsdatoFra <= kapitaliseringsdato)
    .reduce<(typeof skadesinterval.kapitaliseringer)[number] | undefined>((latestEntry, current) => {
      if (latestEntry === undefined) {
        return current;
      }

      return current.kapitaliseringsdatoFra > latestEntry.kapitaliseringsdatoFra
        ? current
        : latestEntry;
    }, undefined);

  if (kandidat === undefined) {
    return undefined;
  }

  const sortedKapitaliseringer = [...skadesinterval.kapitaliseringer].sort((a, b) =>
    a.kapitaliseringsdatoFra.localeCompare(b.kapitaliseringsdatoFra)
  );
  const kandidatIndex = sortedKapitaliseringer.findIndex(
    (entry) =>
      entry.kapitaliseringsdatoFra === kandidat.kapitaliseringsdatoFra &&
      entry.id === kandidat.id
  );
  if (kandidatIndex < 0) {
    return undefined;
  }

  const nextEntry = sortedKapitaliseringer[kandidatIndex + 1];
  const nextDate = nextEntry ? parseISODate(nextEntry.kapitaliseringsdatoFra) : null;
  const gyldigTil = nextDate
    ? dateToISO(addDays(nextDate, -1))
    : `${kandidat.kapitaliseringsdatoFra.slice(0, 4)}-12-31`;
  if (!gyldigTil) {
    return undefined;
  }
  return kapitaliseringsdato <= gyldigTil ? kandidat.id : undefined;
};

type LokalTabelMeta = {
  filnavn: string;
  expectedFilnavn: string;
  id: string;
  gyldigFra: string;
  gyldigTil: string;
};

const readLokalKapitaliseringsTabelMeta = (): LokalTabelMeta[] => {
  const tabellerDir = path.resolve(
    __dirname,
    '../../data/kapitalisering/kapitaliseringsTabeller'
  );
  const filer = fs.readdirSync(tabellerDir).filter((fil) => fil.endsWith('.ts') && fil !== 'index.ts');

  return filer.map((filnavn) => {
    const fuldsti = path.join(tabellerDir, filnavn);
    const source = fs.readFileSync(fuldsti, 'utf8');

    const idMatch = source.match(/export const kapitaliseringsId = '([^']+)'/);
    const gyldigFraMatch = source.match(/export const gyldigFra = toISODateString\('([^']+)'\)/);
    const gyldigTilMatch = source.match(/export const gyldigTil = toISODateString\('([^']+)'\)/);

    if (!idMatch || !gyldigFraMatch || !gyldigTilMatch) {
      throw new Error(`CRITICAL: Mangler id/gyldighedsmetadata i ${filnavn}`);
    }

    return {
      filnavn,
      expectedFilnavn: `${idMatch[1].replace('/', '-')}.ts`,
      id: idMatch[1],
      gyldigFra: gyldigFraMatch[1],
      gyldigTil: gyldigTilMatch[1],
    };
  });
};

describe('kapitaliseringsbekendtgørelser', () => {
  it('max-dato dækker mindst indeværende kalenderår — fejler hvis data ikke opdateres årligt', () => {
    const currentYear = new Date().getFullYear();
    expect(eetKapitaliseringsDatoMaxFraBekendtgoerelser >= `${currentYear}-01-01`).toBe(true);
  });

  it('afleder EET max-dato som 31-12 i laveste seneste kapitaliseringsår på tværs af skadesintervaller', () => {
    const latestPerInterval = kapitaliseringsbekendtgoerelser.map((interval) => {
      const latestFraDate = interval.kapitaliseringer
        .map((entry) => entry.kapitaliseringsdatoFra)
        .reduce((latest, current) => (current > latest ? current : latest));
      return Number.parseInt(latestFraDate.slice(0, 4), 10);
    });

    const expectedYear = Math.min(...latestPerInterval);
    expect(eetKapitaliseringsDatoMaxFraBekendtgoerelser).toBe(`${expectedYear}-12-31`);
  });

  it('vælger deterministisk 9921/2019 frem til og med 2020-12-30, og 9870/2020 på 2020-12-31', () => {
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('2020-12-30'))).toBe('9921/2019');
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('2020-12-31'))).toBe('9870/2020');
  });

  it('skifter deterministisk fra 9820/2023 til 9376/2024 på skæringsdatoen 2024-07-01', () => {
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('2024-06-30'))).toBe('9820/2023');
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('2024-07-01'))).toBe('9376/2024');
    expect(resolveIdForDatoer(toISODateString('2021-01-01'), toISODateString('2024-06-30'))).toBe('9820/2023');
    expect(resolveIdForDatoer(toISODateString('2021-01-01'), toISODateString('2024-07-01'))).toBe('9376/2024');
  });

  it('har fuld 1:1 dækning mellem oversigtens IDer og lokale kapitaliseringstabelfiler', () => {
    const lokaleTabeller = readLokalKapitaliseringsTabelMeta();
    const idSetIoversigt = new Set(
      kapitaliseringsbekendtgoerelser.flatMap((interval) =>
        interval.kapitaliseringer.map((entry) => entry.id)
      )
    );
    const lokalIdSet = new Set(lokaleTabeller.map((tabel) => tabel.id));

    const manglerIoversigtstabeller = [...idSetIoversigt].filter((id) => !lokalIdSet.has(id));
    const udenReferenceIOversigt = lokaleTabeller.filter((tabel) => !idSetIoversigt.has(tabel.id));

    expect(manglerIoversigtstabeller).toEqual([]);
    expect(udenReferenceIOversigt).toEqual([]);
  });

  it('har filnavn der matcher kapitaliseringsId (slash -> bindestreg)', () => {
    const lokaleTabeller = readLokalKapitaliseringsTabelMeta();
    const fejl = lokaleTabeller.filter((tabel) => tabel.filnavn !== tabel.expectedFilnavn);

    expect(fejl).toEqual([]);
  });

  it('holder mappingdatoer inden for gyldighedsintervallet i foreløbigt indføjede tabelfiler', () => {
    const lokaleTabeller = readLokalKapitaliseringsTabelMeta();
    const lokalMap = new Map(lokaleTabeller.map((tabel) => [tabel.id, tabel] as const));

    const fejl = kapitaliseringsbekendtgoerelser.flatMap((interval) =>
      interval.kapitaliseringer
        .filter((entry) => lokalMap.has(entry.id))
        .flatMap((entry) => {
          const lokal = lokalMap.get(entry.id);
          if (!lokal) return [];

          if (entry.kapitaliseringsdatoFra < lokal.gyldigFra || entry.kapitaliseringsdatoFra > lokal.gyldigTil) {
            return [
              {
                skadedatoFra: interval.skadedatoFra,
                id: entry.id,
                kapitaliseringsdatoFra: entry.kapitaliseringsdatoFra,
                fil: lokal.filnavn,
                filGyldigFra: lokal.gyldigFra,
                filGyldigTil: lokal.gyldigTil,
              },
            ];
          }

          return [];
        })
    );

    expect(fejl).toEqual([]);
  });
});
