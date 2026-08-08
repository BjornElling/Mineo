import fs from 'node:fs';
import path from 'node:path';
import {
  assertKapitaliseringsbekendtgoerelserIntegritet,
  kapitaliseringsbekendtgoerelser,
  eetKapitaliseringsDatoMaxFraBekendtgoerelser,
} from '../../data/kapitalisering/kapitaliseringsbekendtgoerelser';
import { assertKapitaliseringsMappingIntegritet } from '../../data/catalog/beregningsdataCatalog';
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

  it('udelader kun PDF-dokumenterede tabeller for skader før 2005', () => {
    type TableField =
      | 'erhvervsevnetabTabeller'
      | 'erhvervsevnetabKoensopdelteTabeller'
      | 'forsoergertabTabeller'
      | 'forsoergertabTabellerMaend'
      | 'forsoergertabTabellerKvinder';

    const tableNames = (id: keyof typeof kapitaliseringsTabelDataById, field: TableField): string[] => {
      const tableData = kapitaliseringsTabelDataById[id];
      return Object.keys(tableData[field]);
    };

    const tablesOnlyBefore2005: ReadonlyArray<readonly [keyof typeof kapitaliseringsTabelDataById, TableField, string[]]> = [
      ['10029/2024', 'erhvervsevnetabTabeller', ['Q', 'R']],
      ['10029/2024', 'forsoergertabTabeller', ['S']],
      ['9376/2024', 'erhvervsevnetabTabeller', ['Q', 'R']],
      ['9376/2024', 'forsoergertabTabeller', ['S']],
      ['10056/2025', 'erhvervsevnetabTabeller', ['U', 'V', 'X', 'Y']],
      ['10056/2025', 'forsoergertabTabeller', ['Z']],
      ['10183/2025', 'erhvervsevnetabTabeller', ['U', 'V', 'X', 'Y']],
      ['10183/2025', 'forsoergertabTabeller', ['Z']],
      ['1221/2010', 'erhvervsevnetabKoensopdelteTabeller', ['O', 'P']],
      ['1221/2010', 'forsoergertabTabellerMaend', ['M']],
      ['1221/2010', 'forsoergertabTabellerKvinder', ['N']],
      ['1403/2011', 'erhvervsevnetabKoensopdelteTabeller', ['O', 'P']],
      ['1403/2011', 'forsoergertabTabellerMaend', ['M']],
      ['1403/2011', 'forsoergertabTabellerKvinder', ['N']],
      ['1700/2015', 'erhvervsevnetabTabeller', ['O', 'P']],
      ['1700/2015', 'forsoergertabTabeller', ['N']],
      ['198/2015', 'erhvervsevnetabTabeller', ['M', 'N']],
      ['198/2015', 'forsoergertabTabeller', ['L']],
    ];

    for (const [id, field, tables] of tablesOnlyBefore2005) {
      expect(tableNames(id, field)).not.toEqual(expect.arrayContaining(tables));
    }

    const mixedTablesWith2005Coverage: ReadonlyArray<readonly [keyof typeof kapitaliseringsTabelDataById, TableField, string[]]> = [
      ['10029/2024', 'erhvervsevnetabTabeller', ['M', 'N', 'O']],
      ['10029/2024', 'forsoergertabTabeller', ['P']],
      ['9376/2024', 'erhvervsevnetabTabeller', ['M', 'N', 'O']],
      ['9376/2024', 'forsoergertabTabeller', ['P']],
      ['10056/2025', 'erhvervsevnetabTabeller', ['P', 'Q', 'R', 'S']],
      ['10056/2025', 'forsoergertabTabeller', ['T']],
      ['10183/2025', 'erhvervsevnetabTabeller', ['P', 'Q', 'R', 'S']],
      ['10183/2025', 'forsoergertabTabeller', ['T']],
      ['1221/2010', 'erhvervsevnetabKoensopdelteTabeller', ['H', 'I', 'J', 'K']],
      ['1403/2011', 'erhvervsevnetabKoensopdelteTabeller', ['H', 'I']],
      ['1700/2015', 'erhvervsevnetabTabeller', ['H', 'I', 'J', 'K', 'L', 'M']],
      ['198/2015', 'erhvervsevnetabTabeller', ['G', 'H', 'I', 'J', 'K']],
    ];

    for (const [id, field, tables] of mixedTablesWith2005Coverage) {
      expect(tableNames(id, field)).toEqual(expect.arrayContaining(tables));
    }
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

  it('fail-closer ved duplikerede intervaldatoer', () => {
    const duplicateDate = toISODateString('2024-01-01');
    expect(() => assertKapitaliseringsbekendtgoerelserIntegritet([{
      skadedatoFra: toISODateString('2011-01-01'),
      kapitaliseringer: [
        { kapitaliseringsdatoFra: duplicateDate, id: 'a' },
        { kapitaliseringsdatoFra: duplicateDate, id: 'b' },
      ],
    }])).toThrow('duplikeret post');
  });

  it('fail-closer ved usorterede skade- og kapitaliseringsdatoer', () => {
    expect(() => assertKapitaliseringsbekendtgoerelserIntegritet([
      { skadedatoFra: toISODateString('2024-01-01'), kapitaliseringer: [
        { kapitaliseringsdatoFra: toISODateString('2024-01-01'), id: 'a' },
      ] },
      { skadedatoFra: toISODateString('2023-01-01'), kapitaliseringer: [
        { kapitaliseringsdatoFra: toISODateString('2023-01-01'), id: 'b' },
      ] },
    ])).toThrow('skadedatointervaller skal være sorteret stigende');

    expect(() => assertKapitaliseringsbekendtgoerelserIntegritet([{
      skadedatoFra: toISODateString('2024-01-01'),
      kapitaliseringer: [
        { kapitaliseringsdatoFra: toISODateString('2024-07-01'), id: 'a' },
        { kapitaliseringsdatoFra: toISODateString('2024-01-01'), id: 'b' },
      ],
    }])).toThrow('datoer for 2024-01-01 skal være sorteret stigende');
  });

  it('fail-closer når resolverens afledte periode går ud over kildetabellens gyldighed', () => {
    const valid = Object.values(kapitaliseringsTabelDataById)[0];
    if (!valid) throw new Error('Testfixture mangler en kapitaliseringstabel');
    const id = valid.kapitaliseringsId;
    const table = {
      ...valid,
      gyldigFra: toISODateString('2024-01-01'),
      gyldigTil: toISODateString('2024-12-31'),
    };

    expect(() => assertKapitaliseringsMappingIntegritet([{
      skadedatoFra: toISODateString('2011-01-01'),
      kapitaliseringer: [
        { kapitaliseringsdatoFra: toISODateString('2024-01-01'), id },
        { kapitaliseringsdatoFra: toISODateString('2026-01-01'), id },
      ],
    }], { [id]: table })).toThrow('men kilden gælder');
  });

  it('fail-closer ved negative faktorer og duplikerede særfaktorintervaller', () => {
    const valid = Object.values(kapitaliseringsTabelDataById)[0];
    if (!valid) throw new Error('Testfixture mangler en kapitaliseringstabel');
    const negativeFactor: KapitaliseringsTabelData = {
      ...valid,
      erhvervsevnetabTabeller: { test: [{ alder: 20, faktor: -1 }] },
    };
    expect(() => assertKapitaliseringsTabelDataIntegritet({ [valid.kapitaliseringsId]: negativeFactor }))
      .toThrow('faktoren skal være positiv');

    const duplicateDate = toISODateString('2024-01-01');
    const duplicateSpecial: KapitaliseringsTabelData = {
      ...valid,
      saerfaktorUnderToAarTilFpPerSkadesinterval: [
        { skadedatoFra: duplicateDate, faktor: 1 },
        { skadedatoFra: duplicateDate, faktor: 2 },
      ],
    };
    expect(() => assertKapitaliseringsTabelDataIntegritet({ [valid.kapitaliseringsId]: duplicateSpecial }))
      .toThrow('duplikeret særfaktorinterval');
  });

  it('fail-closer både ved nye tabelreferencemangler og ved en stale allowlist', () => {
    const valid = Object.values(kapitaliseringsTabelDataById)[0];
    if (!valid) throw new Error('Testfixture mangler en kapitaliseringstabel');
    const missing: KapitaliseringsTabelData = {
      ...valid,
      erhvervsevnetabTabelvalg: [{
        skadedatoFra: toISODateString('2011-01-01'),
        foedselsdatoFra: toISODateString('1900-01-01'),
        foedselsdatoTil: null,
        tabel: 'MANGLER',
      }],
    };
    expect(() => assertKapitaliseringsTabelDataIntegritet(
      { [valid.kapitaliseringsId]: missing },
      new Set(),
    )).toThrow('faktisk');

    expect(() => assertKapitaliseringsTabelDataIntegritet(
      { [valid.kapitaliseringsId]: { ...valid, erhvervsevnetabTabelvalg: [] } },
      new Set([`${valid.kapitaliseringsId}:MANGLER`]),
    )).toThrow('inventory');
  });

  it('fail-closer ved omvendte eller duplikerede fødselsintervaller i EET-tabelvalg', () => {
    const valid = Object.values(kapitaliseringsTabelDataById)[0];
    if (!valid) throw new Error('Testfixture mangler en kapitaliseringstabel');
    const skadedatoFra = toISODateString('2011-01-01');
    const tableName = Object.keys({
      ...valid.erhvervsevnetabTabeller,
      ...valid.erhvervsevnetabKoensopdelteTabeller,
    })[0];
    if (!tableName) throw new Error('Testfixture mangler en EET-faktortabel');

    expect(() => assertKapitaliseringsTabelDataIntegritet({
      [valid.kapitaliseringsId]: {
        ...valid,
        erhvervsevnetabTabelvalg: [{
          skadedatoFra,
          foedselsdatoFra: toISODateString('2000-01-02'),
          foedselsdatoTil: toISODateString('2000-01-01'),
          tabel: tableName,
        }],
      },
    }, new Set())).toThrow('ugyldigt EET-tabelvalg');

    expect(() => assertKapitaliseringsTabelDataIntegritet({
      [valid.kapitaliseringsId]: {
        ...valid,
        erhvervsevnetabTabelvalg: [
          {
            skadedatoFra,
            foedselsdatoFra: toISODateString('1900-01-01'),
            foedselsdatoTil: toISODateString('2000-01-01'),
            tabel: tableName,
          },
          {
            skadedatoFra,
            foedselsdatoFra: toISODateString('1900-01-01'),
            foedselsdatoTil: toISODateString('2000-01-01'),
            tabel: tableName,
          },
        ],
      },
    }, new Set())).toThrow('duplikeret EET-tabelvalg');
  });
});
