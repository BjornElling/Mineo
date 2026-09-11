import {
  getDagenFoerFolkepensionsdato,
  getFolkepensionsdato,
} from '../../../data/folkepensionAlderRates';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

const downstreamFacit: readonly Readonly<{
  foedselsdato: ISODateString;
  opslagsdato: ISODateString;
  folkepensionsdato: string;
  dagenFoer: string;
}>[] = [
  // Første dag i hver lovbestemt opslagsperiode – facit er skrevet direkte som datoer.
  { foedselsdato: iso('1960-01-01'), opslagsdato: iso('2003-01-01'), folkepensionsdato: '2025-01-01', dagenFoer: '2024-12-31' },
  { foedselsdato: iso('1954-01-01'), opslagsdato: iso('2009-07-01'), folkepensionsdato: '2019-07-01', dagenFoer: '2019-06-30' },
  { foedselsdato: iso('1963-01-01'), opslagsdato: iso('2015-12-29'), folkepensionsdato: '2031-01-01', dagenFoer: '2030-12-31' },
  { foedselsdato: iso('1967-01-01'), opslagsdato: iso('2020-12-31'), folkepensionsdato: '2036-01-01', dagenFoer: '2035-12-31' },
  { foedselsdato: iso('1971-01-01'), opslagsdato: iso('2025-12-31'), folkepensionsdato: '2041-01-01', dagenFoer: '2040-12-31' },
];

describe('TD-020 – folkepensionsdato som downstream-konsument', () => {
  it('fører alle opslagsperioders folkepensionsalder til korrekt dato og dagen før', () => {
    for (const facit of downstreamFacit) {
      expect(getFolkepensionsdato(facit.foedselsdato, facit.opslagsdato))
        .toBe(facit.folkepensionsdato);
      expect(getDagenFoerFolkepensionsdato(facit.foedselsdato, facit.opslagsdato))
        .toBe(facit.dagenFoer);
    }
  });

  it('viderefører manglende opslagsdækning som undefined i begge downstream-funktioner', () => {
    const foedselsdato = iso('1960-01-01');
    const udenDækning = iso('2002-12-31');

    expect(getFolkepensionsdato(foedselsdato, udenDækning)).toBeUndefined();
    expect(getDagenFoerFolkepensionsdato(foedselsdato, udenDækning)).toBeUndefined();
  });
});
