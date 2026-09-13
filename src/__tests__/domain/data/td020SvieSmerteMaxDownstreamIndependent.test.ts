import { computeSvieSmerteEngine, type SvieSmerteCalculationValues } from '../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toKroner, type MoneyOre } from '../../../domain/money/money';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

type ExpectedResult = Readonly<{
  satserAar: number | null;
  satserPerDagKroner: number | null;
  satserMaxKroner: number | null;
  satserPerDagFoerForligKroner: number | null;
  satserMaxFoerForligKroner: number | null;
  tidligereKroner: number | null;
  aktuelKroner: number | null;
  sygedage: number;
  delviseSygedage: number;
  delvisFaktor: 1 | 0.5;
  maxApplied: boolean;
  totalKroner: number;
}>;

const toNullableKroner = (value: MoneyOre | null): number | null =>
  value === null ? null : toKroner(value);

const makeValues = (): SvieSmerteCalculationValues => ({
  ...structuredClone(createErstatningsopgoerelseInitialValues()),
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  tidligereSsMax: 'Nej',
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2025-01-20'),
  svieSmertePerioder: [
    {
      id: 'td020-svie-smerte-max',
      fra: iso('2024-01-01'),
      til: iso('2025-01-20'),
      tilstand: 'sygemeldt',
    },
  ],
  svieSmerteSatserAar: 2024,
  svieSmerteDelvisSygemeldingSats: 'fuld',
  svieSmerteTidligereTotal: asAmountValue(20_000),
  svieSmerteAktuelPeriode: asAmountValue(3_500),
});

describe('DATA-001/CALC-006/TD-020 – svie/smerte-maksimum som downstream-facit', () => {
  it('anvender 2024-maksimum efter tidligere og aktuel godtgørelse', () => {
    const result = computeSvieSmerteEngine({ erstatningsopgoerelse: makeValues() });

    // 386 hele dage: 386 × 230 kr. = 88.780 kr. Maksimum er 88.500 kr.; efter
    // 20.000 kr. tidligere og 3.500 kr. aktuelt udbetalt er restbeløbet 65.000 kr.
    const expectedResult: ExpectedResult = {
      satserAar: 2024,
      satserPerDagKroner: 230,
      satserMaxKroner: 88_500,
      satserPerDagFoerForligKroner: 230,
      satserMaxFoerForligKroner: 88_500,
      tidligereKroner: 20_000,
      aktuelKroner: 3_500,
      sygedage: 386,
      delviseSygedage: 0,
      delvisFaktor: 1,
      maxApplied: true,
      totalKroner: 65_000,
    };

    expect({
      satserAar: result.satserAar,
      satserPerDagKroner: toNullableKroner(result.satserPerDagOre),
      satserMaxKroner: toNullableKroner(result.satserMaxOre),
      satserPerDagFoerForligKroner: toNullableKroner(result.satserPerDagFoerForligOre),
      satserMaxFoerForligKroner: toNullableKroner(result.satserMaxFoerForligOre),
      tidligereKroner: toNullableKroner(result.tidligereOre),
      aktuelKroner: toNullableKroner(result.aktuelOre),
      sygedage: result.sygedage,
      delviseSygedage: result.delviseSygedage,
      delvisFaktor: result.delvisFaktor,
      maxApplied: result.maxApplied,
      totalKroner: toKroner(result.totalOre),
    }).toEqual(expectedResult);

    expect(result.constrainedPeriods).toEqual([
      { fra: iso('2024-01-01'), til: iso('2025-01-20'), isDelvist: false },
    ]);
    expect(result.harInputPerioder).toBe(true);
    expect(result.harPerioder).toBe(true);
    expect(result.opgjortFremTilPeriodeTil).toBe(true);
  });
});
