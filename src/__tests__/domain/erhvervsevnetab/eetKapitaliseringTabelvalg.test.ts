import { kapitaliseringsTabelDataById, type KapitaliseringsTabelData } from '../../../data/kapitalisering/kapitaliseringsTabeller';
import { resolveKapitaliseringTabelvalg } from '../../../domain/erhvervsevnetab/eetKapitaliseringOpslag';
import { toISODateString } from '../../../types/branded';

const kilde = (id: string): KapitaliseringsTabelData => {
  const data = kapitaliseringsTabelDataById[id];
  if (!data) throw new Error(`Testfixture mangler ${id}`);
  return data;
};

const tabelFor = (id: string, skadedato: string, foedselsdato: string, opslagsdato: string): string | null =>
  resolveKapitaliseringTabelvalg(
    kilde(id),
    toISODateString(skadedato),
    toISODateString(foedselsdato),
    toISODateString(opslagsdato),
  )?.tabel ?? null;

describe('EET-tabelvalg – én sammenhængende årgang pr. fødselsdato', () => {
  it('vælger kildens ældste årgang (tabel E) for tilskadekomne født før 1959 i BEK 1220/2010', () => {
    // Tabelvalget manglede årgangen «født før 1. januar 1959», så opslaget faldt tilbage på tabel A.
    expect(tabelFor('1220/2010', '2011-03-01', '1958-06-01', '2011-06-01')).toBe('E');
    expect(tabelFor('1220/2010', '2011-03-01', '1959-01-01', '2011-06-01')).toBe('D');
    expect(tabelFor('1220/2010', '2011-03-01', '1960-07-01', '2011-06-01')).toBe('A');
  });

  it('vælger tabel F for tilskadekomne født før 1954 i BEK 1664/2015', () => {
    expect(tabelFor('1664/2015', '2011-03-01', '1953-06-01', '2016-03-01')).toBe('F');
  });

  it('afgrænser de moderne vejledningers årgange eksplicit (fx 9921/2019 tabel B til 1962)', () => {
    expect(tabelFor('9921/2019', '2015-03-01', '1962-12-31', '2020-03-01')).toBe('B');
    expect(tabelFor('9921/2019', '2015-03-01', '1963-01-01', '2020-03-01')).toBe('A');
  });

  it('bruger den ældste årgangs tabel for årgange uden tabel, når særfaktoren gælder', () => {
    // BEK 1156/2017 har ingen tabel for født før 1. juli 1954: de er højst 2 år fra folkepension i 2018.
    expect(tabelFor('1156/2017', '2012-03-01', '1954-03-01', '2018-03-01')).toBe('D');
  });

  it('fail-closer for en årgang uden tabel, når særfaktoren ikke gælder', () => {
    const syntetisk: KapitaliseringsTabelData = {
      ...kilde('1156/2017'),
      erhvervsevnetabTabelvalg: kilde('1156/2017').erhvervsevnetabTabelvalg
        .filter((valg) => valg.tabel === 'A')
        .map((valg) => ({ ...valg, foedselsdatoFra: toISODateString('1970-01-01') })),
    };
    // Født 1965 er langt fra folkepension i 2018 – et manglende tabelvalg må ikke dækkes af særfaktor-vejen.
    expect(resolveKapitaliseringTabelvalg(
      syntetisk,
      toISODateString('2012-03-01'),
      toISODateString('1965-01-01'),
      toISODateString('2018-03-01'),
    )).toBeNull();
  });
});
