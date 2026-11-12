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
  it('skifter til 10253/2026 ved årsskiftet 2027 og afviser 2028 for alle understøttede skadesperioder', () => {
    for (const skadedato of ['2005-01-01', '2007-07-01', '2011-01-01', '2021-01-01']) {
      expect(resolveIdForDatoer(toISODateString(skadedato), toISODateString('2026-12-31'))).toBe('10056/2025');
      expect(resolveIdForDatoer(toISODateString(skadedato), toISODateString('2027-01-01'))).toBe('10253/2026');
      expect(resolveIdForDatoer(toISODateString(skadedato), toISODateString('2027-12-31'))).toBe('10253/2026');
      expect(resolveIdForDatoer(toISODateString(skadedato), toISODateString('2028-01-01'))).toBeNull();
    }
  });

  it('max-dato dækker mindst indeværende kalenderår – fejler hvis data ikke opdateres årligt', () => {
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

  it('fail-closed: skadedato før lov om arbejdsskadesikring (2004-01-01) → null', () => {
    expect(resolveIdForDatoer(toISODateString('2003-12-31'), toISODateString('2024-01-01'))).toBeNull();
  });

  it('skifter fra BEK 1202/2013 til den rettede særfaktor i BEK 229/2014 den 15. marts 2014', () => {
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('2014-03-14'))).toBe('1202/2013');
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('2014-03-15'))).toBe('229/2014');
    expect(resolveIdForDatoer(toISODateString('2011-01-01'), toISODateString('2014-12-31'))).toBe('229/2014');
    expect(kapitaliseringsTabelDataById['1202/2013']?.saerfaktorUnderToAarTilFpPerSkadesinterval[0]?.faktor).toBe(1.2514);
    expect(kapitaliseringsTabelDataById['229/2014']?.saerfaktorUnderToAarTilFpPerSkadesinterval[0]?.faktor).toBe(1.251);
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

  it('har indlæst de tabeller, der tidligere manglede, og udelader kun begrundede kildetabeller', () => {
    const indlaeste = (id: string): string[] => {
      const data = kapitaliseringsTabelDataById[id];
      if (!data) throw new Error(`mangler ${id}`);
      return Object.keys({
        ...data.erhvervsevnetabTabeller,
        ...data.erhvervsevnetabKoensopdelteTabeller,
        ...data.forsoergertabTabeller,
        ...data.forsoergertabTabellerMaend,
        ...data.forsoergertabTabellerKvinder,
      });
    };
    // Skader 1. januar 2004 – 30. juni 2007 kapitaliseret 2011-2020, og forsørgertab i 2014 (BEK 1339/2013).
    expect(indlaeste('1221/2010')).toEqual(expect.arrayContaining(['L', 'M', 'N']));
    expect(indlaeste('1403/2011')).toEqual(expect.arrayContaining(['J', 'K', 'L', 'M', 'N']));
    expect(indlaeste('198/2015')).toEqual(expect.arrayContaining(['L']));
    expect(indlaeste('1700/2015')).toEqual(expect.arrayContaining(['N']));
    expect(indlaeste('1202/2013')).toEqual(expect.arrayContaining(['F', 'G']));

    const grunde = new Set(Object.values(kapitaliseringsTabelDataById)
      .flatMap((data) => Object.values(data.udeladteKildetabeller)));
    expect([...grunde].sort()).toEqual(['afloesningsbeloeb', 'behandlingsudgifter', 'skader-foer-2004', 'varigt-men']);
  });

  it('kønsopdeler præcis de kilder, der gælder før 1. marts 2015 (forsørgertabets input-regel)', () => {
    for (const data of Object.values(kapitaliseringsTabelDataById)) {
      const koensopdelt = data.forsoergertabTabelvalg.every((valg) => valg.koensopdelt);
      expect({ id: data.kapitaliseringsId, koensopdelt }).toEqual({
        id: data.kapitaliseringsId,
        koensopdelt: data.gyldigTil < '2015-03-01',
      });
    }
  });

  it('har præcis kildernes original-PDF\'er (primære og supplerende ændringsakter) i kildemappen', () => {
    const pdfDir = path.resolve(__dirname, '../../data/kapitalisering/kapitaliseringOriginalPdf');
    const actual = fs.readdirSync(pdfDir).filter((file) => file.toLowerCase().endsWith('.pdf')).sort();
    const expected = [...new Set(Object.values(kapitaliseringsTabelDataById).flatMap((entry) =>
      [entry.kildePdfFil, ...entry.supplerendeKildePdfFiler]))].sort();
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

  it('fail-closer ved en valgt tabel uden faktorer, en indlæst tabel uden valg og en tavst manglende kildetabel', () => {
    const valid = kapitaliseringsTabelDataById['1221/2010'];
    if (!valid) throw new Error('Testfixture mangler 1221/2010');
    const check = (entry: KapitaliseringsTabelData) => () =>
      assertKapitaliseringsTabelDataIntegritet({ [entry.kapitaliseringsId]: entry });

    const udenL = Object.fromEntries(
      Object.entries(valid.erhvervsevnetabKoensopdelteTabeller).filter(([navn]) => navn !== 'L')
    );
    expect(check({ ...valid, erhvervsevnetabKoensopdelteTabeller: udenL })).toThrow('skal hver være indlæst');
    expect(check({
      ...valid,
      erhvervsevnetabKoensopdelteTabeller: udenL,
      udeladteKildetabeller: { ...valid.udeladteKildetabeller, L: 'skader-foer-2004' },
    })).toThrow('matcher ikke EET-tabellerne');
    expect(check({ ...valid, kildetabeller: [...valid.kildetabeller, 'T'] })).toThrow('skal hver være indlæst');
    expect(check({
      ...valid,
      forsoergertabTabelvalg: valid.forsoergertabTabelvalg.filter((valg) => valg.skadedatoFra !== '2004-01-01'),
    })).toThrow('matcher ikke tabellerne');
  });

  it('fail-closer ved manglende eller overtallig særfaktor', () => {
    const valid = kapitaliseringsTabelDataById['1221/2010'];
    if (!valid) throw new Error('Testfixture mangler 1221/2010');
    expect(() => assertKapitaliseringsTabelDataIntegritet({
      [valid.kapitaliseringsId]: { ...valid, saerfaktorUnderToAarTilFpPerSkadesinterval: [] },
    })).toThrow('særfaktor findes for');
    expect(() => assertKapitaliseringsTabelDataIntegritet({
      [valid.kapitaliseringsId]: {
        ...valid,
        saerfaktorUnderToAarTilFpPerSkadesinterval: [
          ...valid.saerfaktorUnderToAarTilFpPerSkadesinterval,
          { skadedatoFra: toISODateString('2004-01-01'), faktor: 1.1 },
        ],
      },
    })).toThrow('særfaktor findes for');
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
    })).toThrow('ugyldigt EET-tabelvalg');

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
    })).toThrow('overlapper eller har et hul');
  });
});
