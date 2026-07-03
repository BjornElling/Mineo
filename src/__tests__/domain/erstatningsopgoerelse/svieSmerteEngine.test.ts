import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeSvieSmerteEngine } from '../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine';
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

  it('regner totalen med den AFRUNDEDE delvis-dagssats (efterregnelig fra vist sats)', () => {
    // Sats 215 kr (2022) × forlig 33 % = 70,95 kr = 7.095 øre (ulige), så delvis-satsen
    // (× 0,5 = 3.547,5 øre) får en halv øre. Totalen skal bruge den afrundede delvis-sats
    // (3.548 øre), så brugeren kan efterregne "N delvise sygedage á [vist delvis-sats]".
    const result = computeSvieSmerteEngine({
      erstatningsopgoerelse: makeValues({
        tidligereSsMax: 'Nej',
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2022-04-10'),
        svieSmertePerioder: [
          { id: '1', fra: iso('2022-01-01'), til: iso('2022-04-10'), tilstand: 'delvist-sygemeldt' },
        ],
        svieSmerteSatserAar: 2022,
        svieSmerteDelvisSygemeldingSats: 'halv',
        forligAnsvarsgradProcent: 33,
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      }),
    });

    expect(result.satserPerDagOre).toBe(7_095);
    expect(result.delvisFaktor).toBe(0.5);
    expect(result.sygedage).toBe(0);
    expect(result.delviseSygedage).toBeGreaterThan(0);
    if (result.satserPerDagOre === null) return;

    const afrundetDelvisOre = Math.round(result.satserPerDagOre * result.delvisFaktor); // 3.548
    expect(afrundetDelvisOre).toBe(3_548);
    // Total = delvise sygedage × den afrundede delvis-sats (efterregnelig).
    expect(result.totalOre).toBe(result.delviseSygedage * afrundetDelvisOre);
    // Den gamle (u-afrundede) beregning ville give 0,5 øre mindre pr. delvis sygedag.
    const gammelUafrundet = Math.round(result.delviseSygedage * (result.satserPerDagOre * result.delvisFaktor));
    expect(result.totalOre).not.toBe(gammelUafrundet);
  });

  it('anvender forlig før max-cap i svie/smerte', () => {
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
        forligAnsvarsgradProcent: 50,
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      }),
    });

    expect(result.satserPerDagOre).toBe(12_500);
    expect(result.satserMaxOre).toBe(4_800_000);
    expect(result.totalOre).toBe(4_800_000);
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
