import fs from 'node:fs';
import path from 'node:path';
import {
  kapitaliseringsbekendtgoerelser,
  eetKapitaliseringsDatoMaxFraBekendtgoerelser,
} from '../../data/kapitalisering/kapitaliseringsbekendtgoerelser';
import {
  assertKapitaliseringsTabelDataIntegritet,
  kapitaliseringsTabelDataById,
  type KapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import { resolveKapitaliseringsbekendtgoerelseId } from '../../domain/erhvervsevnetab/eetKapitaliseringOpslag';
import { toISODateString } from '../../types/branded';

// Test mod den kanoniske produktions-resolver (ikke en lokal kopi), så testen ikke
// kan divergere fra den faktiske opslagslogik.
const resolveIdForDatoer = (skadedato: string, kapitaliseringsdato: string): string | null =>
  resolveKapitaliseringsbekendtgoerelseId(toISODateString(skadedato), toISODateString(kapitaliseringsdato));

const readKapitaliseringsTabelFilnavne = (): string[] => {
  const tabellerDir = path.resolve(
    __dirname,
    '../../data/kapitalisering/kapitaliseringsTabeller'
  );
  return fs.readdirSync(tabellerDir).filter((fil) => fil.endsWith('.ts') && fil !== 'index.ts').sort();
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

  it('fail-closed: skadedato før første interval (1978-04-01) → null', () => {
    expect(resolveIdForDatoer(toISODateString('1978-03-31'), toISODateString('2024-01-01'))).toBeNull();
  });

  it('fail-closed: kapitaliseringsdato før enhver kapitalisering i intervallet → null', () => {
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('1990-01-01'))).toBeNull();
  });

  it('har fuld 1:1 dækning mellem oversigtens IDer og lokale kapitaliseringstabelfiler', () => {
    const idSetIoversigt = new Set(
      kapitaliseringsbekendtgoerelser.flatMap((interval) =>
        interval.kapitaliseringer.map((entry) => entry.id)
      )
    );
    const lokalIdSet = new Set(Object.keys(kapitaliseringsTabelDataById));

    const manglerIoversigtstabeller = [...idSetIoversigt].filter((id) => !lokalIdSet.has(id));
    const udenReferenceIOversigt = [...lokalIdSet].filter((id) => !idSetIoversigt.has(id));

    expect(manglerIoversigtstabeller).toEqual([]);
    expect(udenReferenceIOversigt).toEqual([]);
  });

  it('har filnavn der matcher kapitaliseringsId (slash -> bindestreg)', () => {
    const expected = Object.keys(kapitaliseringsTabelDataById).map((id) => `${id.replace('/', '-')}.ts`).sort();
    expect(readKapitaliseringsTabelFilnavne()).toEqual(expected);
  });

  it('har præcis én lokal original-PDF pr. katalogiseret tabel', () => {
    const pdfDir = path.resolve(__dirname, '../../data/kapitalisering/kapitaliseringOriginalPdf');
    const actual = fs.readdirSync(pdfDir).filter((file) => file.toLowerCase().endsWith('.pdf')).sort();
    const expected = Object.values(kapitaliseringsTabelDataById).map((entry) => entry.kildePdfFil).sort();
    expect(actual).toEqual(expected);
  });

  it('holder mappingdatoer inden for gyldighedsintervallet i foreløbigt indføjede tabelfiler', () => {
    const fejl = kapitaliseringsbekendtgoerelser.flatMap((interval) =>
      interval.kapitaliseringer
        .flatMap((entry) => {
          const lokal = kapitaliseringsTabelDataById[entry.id];
          if (!lokal) return [];

          if (entry.kapitaliseringsdatoFra < lokal.gyldigFra || entry.kapitaliseringsdatoFra > lokal.gyldigTil) {
            return [
              {
                skadedatoFra: interval.skadedatoFra,
                id: entry.id,
                kapitaliseringsdatoFra: entry.kapitaliseringsdatoFra,
                fil: lokal.kildePdfFil,
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

  it('fail-closer ved ugyldig metadata og ikke-finite faktorer', () => {
    const valid = Object.values(kapitaliseringsTabelDataById)[0];
    if (!valid) throw new Error('Testfixture mangler en kapitaliseringstabel');
    const invalid: KapitaliseringsTabelData = {
      ...valid,
      gyldigFra: toISODateString('2026-01-02'),
      gyldigTil: toISODateString('2026-01-01'),
    };
    expect(() => assertKapitaliseringsTabelDataIntegritet({ [invalid.kapitaliseringsId]: invalid }))
      .toThrow('ugyldige metadata');

    const invalidFactor: KapitaliseringsTabelData = {
      ...valid,
      erhvervsevnetabTabeller: { test: [{ alder: 20, faktor: Number.NaN }] },
    };
    expect(() => assertKapitaliseringsTabelDataIntegritet({ [invalidFactor.kapitaliseringsId]: invalidFactor }))
      .toThrow('faktoren skal være et endeligt tal');
  });
});
