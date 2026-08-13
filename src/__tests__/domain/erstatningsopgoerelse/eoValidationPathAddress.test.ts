/**
 * Værn for sikkerhedsnettets fejllink i "Fejl og advarsler".
 *
 * Sikkerhedsnettet (`blocking-invariant:*`) findes for de autoritativt blokerende validerings-invarianter,
 * som INGEN row-builder har dannet en EO-række for — garantien er, at download aldrig blokeres uden en
 * synlig fejl. Men netop fordi der ikke findes en række, fandtes der heller intet fokusmål: rækkerne blev
 * vist som ren tekst uden link, og brugeren fik ingen anvisning på hvor indtastningen hører.
 *
 * Invarianten bærer validatorens egen felt-sti som `evidence`, og for top-level-felter ER stien
 * descriptorens feltnavn. Opslaget sker mod produktionens EGET katalog, så en omdøbning bliver synlig her
 * frem for at efterlade et link, der peger på ingenting.
 *
 * Den anden halvdel af kontrakten er lige så vigtig: en sti, kataloget ikke kan opløse ENTYDIGT, skal give
 * `undefined`, så nettet beholder sin sande adfærd (tekst uden link) frem for at sende brugeren til et
 * gættet felt.
 */
import { resolveEoValidationPathAddress } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import {
  eoUspecificeredeFerieFridageField,
  eoVedroererPeriodeFraField,
  eoOevrigeFravaersdageField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';

describe('resolveEoValidationPathAddress', () => {
  it.each([
    { path: 'uspecificeredeFerieFridage', field: eoUspecificeredeFerieFridageField },
    { path: 'vedroererPeriodeFra', field: eoVedroererPeriodeFraField },
    { path: 'oevrigeFravaersdage', field: eoOevrigeFravaersdageField },
  ])('opløser top-level-stien $path til feltets kanoniske adresse', ({ path, field }) => {
    expect(resolveEoValidationPathAddress(path)).toEqual(field.bind().address);
  });

  it.each([
    // Nested rækkesti: feltet ligger under en collection-række, og rækken kan ikke udledes af stien.
    'tafPerioder[0].fra',
    'loenindkomstAnsaettelsesforhold.0.feriePct',
    // Rene indeks-stier fra validatorens fallback (`${index}` når `path` mangler).
    '0',
    '12',
    // Ukendt felt: ingen descriptor bærer navnet.
    'etFeltDerIkkeFindes',
    // Tom/uangivet sti.
    '',
  ])('giver undefined for stien %s, så nettet ikke gætter et felt', (path) => {
    expect(resolveEoValidationPathAddress(path)).toBeUndefined();
  });

  it('giver undefined når invarianten slet ikke bærer en sti', () => {
    expect(resolveEoValidationPathAddress(undefined)).toBeUndefined();
  });

  it('opløser ikke et felt, der bor under en property-sti', () => {
    // `eoAngivetLoenLoenudvikling.*`-felterne har et property-led i templaten og er derfor ikke
    // top-level. Et bart feltnavn må ikke kunne ramme dem, for så ville linket pege på et felt i en
    // anden struktur end den, stien beskriver.
    expect(resolveEoValidationPathAddress('overenskomstId')).toBeUndefined();
  });
});
