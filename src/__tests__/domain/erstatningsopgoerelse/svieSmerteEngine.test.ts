import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeSvieSmerteEngine } from '../../../domain/erstatningsopgoerelse/svieSmerteEngine';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return { ...base, ...patch };
};

describe('computeSvieSmerteEngine', () => {
  it('beregner totalOre for 100 sygedage uden forlig/fradrag', () => {
    const result = computeSvieSmerteEngine({
      erstatningsopgoerelse: makeValues({
        tidligereSsMax: 'Nej',
        vedroererPeriodeFra: iso('2024-01-01'),
        vedroererPeriodeTil: iso('2024-04-09'),
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      }),
    });

    expect(result.totalOre).toBe(2_500_000);
    expect(result.sygedage).toBe(100);
    expect(result.delviseSygedage).toBe(0);
  });

  it('anvender max-cap', () => {
    const result = computeSvieSmerteEngine({
      erstatningsopgoerelse: makeValues({
        tidligereSsMax: 'Nej',
        vedroererPeriodeFra: iso('2024-01-01'),
        vedroererPeriodeTil: iso('2025-02-04'),
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2025-02-04'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      }),
    });

    expect(result.totalOre).toBe(9_600_000);
    expect(result.maxApplied).toBe(true);
  });

  it('fratraekker tidligere opgjort og aktuel periode', () => {
    const result = computeSvieSmerteEngine({
      erstatningsopgoerelse: makeValues({
        tidligereSsMax: 'Nej',
        vedroererPeriodeFra: iso('2024-01-01'),
        vedroererPeriodeTil: iso('2024-04-28'),
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-28'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(70_000),
        svieSmerteAktuelPeriode: asAmountValue(10_000),
      }),
    });

    expect(result.totalOre).toBe(1_600_000);
  });

  it('beregner delvise sygedage med halv faktor', () => {
    const result = computeSvieSmerteEngine({
      erstatningsopgoerelse: makeValues({
        tidligereSsMax: 'Nej',
        vedroererPeriodeFra: iso('2024-01-01'),
        vedroererPeriodeTil: iso('2024-04-09'),
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'delvist-sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'halv',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      }),
    });

    expect(result.totalOre).toBe(1_250_000);
    expect(result.sygedage).toBe(0);
    expect(result.delviseSygedage).toBe(100);
  });

  it('returnerer 0 ved ingen perioder', () => {
    const result = computeSvieSmerteEngine({
      erstatningsopgoerelse: makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [],
      }),
    });

    expect(result.totalOre).toBe(0);
    expect(result.harPerioder).toBe(false);
  });
});
