import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  resolveEffektivtSvieSmerteMaksimum,
  resolveSvieSmerteTidligereTotalOverMaxWarning,
} from '../../../domain/erstatningsopgoerelse/helpers/svieSmerteMaksimum';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...structuredClone(createErstatningsopgoerelseInitialValues()),
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  tidligereSsMax: 'Nej',
  eoNummer: '2',
  svieSmerteSatserAar: 2024,
  ...patch,
});

describe('svieSmerteMaksimum', () => {
  it('finder det effektive maksimum uden forlig, med procentforlig og med brøkforlig', () => {
    expect(resolveEffektivtSvieSmerteMaksimum(makeValues())).toBe(88_500);
    expect(resolveEffektivtSvieSmerteMaksimum(makeValues({ forligAnsvarsgradProcent: 50 }))).toBe(44_250);
    expect(resolveEffektivtSvieSmerteMaksimum(makeValues({
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: '2/3',
    }))).toBe(59_000);
  });

  it('afrunder brøkforligets maksimum til hele øre som beregningen og visningen (NY-12b-2)', () => {
    // 88.500 / 7 = 12.642,857… – beregningen og «Satser per dag/max» bruger 12.642,86.
    expect(resolveEffektivtSvieSmerteMaksimum(makeValues({
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: '1/7',
    }))).toBe(12_642.86);
  });

  it('advarer først, når tidligere opgjort beløb overstiger det VISTE maksimum ved brøkforlig (NY-12b-2)', () => {
    const medBroek = (tidligere: number) => makeValues({
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: '1/7',
      svieSmerteTidligereTotal: asAmount(tidligere),
    });
    expect(resolveSvieSmerteTidligereTotalOverMaxWarning(medBroek(12_642.86))).toBeNull();
    expect(resolveSvieSmerteTidligereTotalOverMaxWarning(medBroek(12_642.87))).toBe(
      'Svie/smerte opgjort i tidligere erstatningsopgørelser overstiger maksimum (12.642,86 kr.)'
    );
  });

  it('returnerer ingen grænse for manglende eller ukendt satsår', () => {
    expect(resolveEffektivtSvieSmerteMaksimum(makeValues({ svieSmerteSatserAar: undefined }))).toBeUndefined();
    expect(resolveEffektivtSvieSmerteMaksimum(makeValues({ svieSmerteSatserAar: 1900 }))).toBeUndefined();
  });

  it('advarer med det effektive maksimum, når tidligere opgjort beløb overstiger det', () => {
    expect(resolveSvieSmerteTidligereTotalOverMaxWarning(makeValues({
      svieSmerteTidligereTotal: asAmount(90_000),
    }))).toBe('Svie/smerte opgjort i tidligere erstatningsopgørelser overstiger maksimum (88.500,00 kr.)');
    expect(resolveSvieSmerteTidligereTotalOverMaxWarning(makeValues({
      svieSmerteTidligereTotal: asAmount(88_500),
    }))).toBeNull();
  });

  it('giver ingen advarsel for irrelevant, tomt eller uden grænse-beløb', () => {
    expect(resolveSvieSmerteTidligereTotalOverMaxWarning(makeValues({
      eoNummer: '1',
      svieSmerteTidligereTotal: asAmount(90_000),
    }))).toBeNull();
    expect(resolveSvieSmerteTidligereTotalOverMaxWarning(makeValues({
      svieSmerteTidligereTotal: undefined,
    }))).toBeNull();
    expect(resolveSvieSmerteTidligereTotalOverMaxWarning(makeValues({
      svieSmerteSatserAar: 1900,
      svieSmerteTidligereTotal: asAmount(90_000),
    }))).toBeNull();
  });
});
