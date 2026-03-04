import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  kapitaliseringsbekendtgoerelser,
  eetKapitaliseringsDatoMaxFraBekendtgoerelser,
} from '../../data/kapitalisering/kapitaliseringsbekendtgørelser';

const resolveIdForDatoer = (
  skadesdato: string,
  kapitaliseringsdato: string
): string | undefined => {
  const skadesinterval = kapitaliseringsbekendtgoerelser
    .filter((interval) => interval.skadesdatoFra <= skadesdato)
    .reduce((latest, current) =>
      current.skadesdatoFra > latest.skadesdatoFra ? current : latest
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

  const aar = kandidat.kapitaliseringsdatoFra.slice(0, 4);
  const gyldigTil = `${aar}-12-31`;
  return kapitaliseringsdato <= gyldigTil ? kandidat.id : undefined;
};

type LokalTabelMeta = {
  filnavn: string;
  id: string;
  gyldigFra: string;
  gyldigTil: string;
};

const readLokalKapitaliseringsTabelMeta = (): LokalTabelMeta[] => {
  const tabellerDir = path.resolve(
    __dirname,
    '../../data/kapitalisering/kapitaliseringsTabeller'
  );
  const filer = fs.readdirSync(tabellerDir).filter((fil) => fil.endsWith('.ts'));

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
      id: idMatch[1],
      gyldigFra: gyldigFraMatch[1],
      gyldigTil: gyldigTilMatch[1],
    };
  });
};

describe('kapitaliseringsbekendtgørelser', () => {
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
    expect(resolveIdForDatoer('2011-01-01', '2020-12-30')).toBe('9921/2019');
    expect(resolveIdForDatoer('2011-01-01', '2020-12-31')).toBe('9870/2020');
  });

  it('skifter deterministisk fra 9820/2023 til 9376/2024 på skæringsdatoen 2024-07-01', () => {
    expect(resolveIdForDatoer('2011-01-01', '2024-06-30')).toBe('9820/2023');
    expect(resolveIdForDatoer('2011-01-01', '2024-07-01')).toBe('9376/2024');
    expect(resolveIdForDatoer('2021-01-01', '2024-06-30')).toBe('9820/2023');
    expect(resolveIdForDatoer('2021-01-01', '2024-07-01')).toBe('9376/2024');
  });

  it('matcher alle foreløbigt indføjede tabelfiler med mindst én reference i oversigten', () => {
    const lokaleTabeller = readLokalKapitaliseringsTabelMeta();
    const idSetIoversigt = new Set(
      kapitaliseringsbekendtgoerelser.flatMap((interval) =>
        interval.kapitaliseringer.map((entry) => entry.id)
      )
    );

    const manglerIOversigt = lokaleTabeller.filter((tabel) => !idSetIoversigt.has(tabel.id));
    expect(manglerIOversigt).toEqual([]);
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
                skadesdatoFra: interval.skadesdatoFra,
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
