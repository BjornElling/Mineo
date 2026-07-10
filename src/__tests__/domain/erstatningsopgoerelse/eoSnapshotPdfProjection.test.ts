
vi.mock('../../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
}));

import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { eoSnapshotToTafPerYearDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument';
import { eoSnapshotToTafPerYearOpreguleretDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument';
import {
  buildControlMismatchInvariant,
  buildTafPerYearOpreguleretManglendeReguleringssatsInvariant,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import { moneyOre } from '../../../domain/money/money';
import { toISODateString } from '../../../types/branded';

const buildBaseSnapshot = () => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
  eoValues.vedroererPeriodeTil = toISODateString('2024-01-31');
  eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
  eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
  eoValues.oevrigeKravPerioder = [
    {
      id: 'krav-1',
      dato: toISODateString('2024-01-15'),
      udgiftTil: 'Transport',
      beloeb: { kind: 'number', value: 1200 },
    },
  ];

  const snapshot = computeEoSnapshot({
    revision: 'projection-base',
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues,
  });

  expect(snapshot.status).toBe('ok');
  expect(snapshot.data).not.toBeNull();
  return snapshot;
};

const FAKE_TAF_PER_YEAR_RESULT: TafPerYearResult = {
  years: [
    {
      year: 2024,
      segments: [],
      deductions: [],
      yearIncomeOre: moneyOre(0),
      yearDeductionsOre: moneyOre(0),
      yearTidligereModtagetTafOre: moneyOre(0),
      yearTafFoerForligOre: moneyOre(0),
      yearTafOre: moneyOre(0),
    },
  ],
  sumYearTafOre: moneyOre(0),
  afrundingOre: moneyOre(0),
  samletTafKravOre: moneyOre(0),
};

describe('EO snapshot PDF projections', () => {
  it('tillader EO-PDF ved warning-status uden eo_pdf-blokering', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToEoDocument({
      ...snapshot,
      status: 'warning',
      invariants: [
        ...snapshot.invariants,
        {
          id: 'warning:test',
          passed: false,
          severity: 'warning',
          source: 'validation' as const,
          message: 'Kun advarsel',
          blocksAuthoritativeComputation: false,
        },
      ],
    });

    expect(projection.kind).toBe('ok');
  });

  it('blokerer EO-PDF ved eo_pdf-blokerende invariant', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToEoDocument({
      ...snapshot,
      status: 'error',
      invariants: [buildControlMismatchInvariant(['Mismatch'])],
    });

    expect(projection).toEqual({
      kind: 'blocked',
      message: 'Der er konstateret kontroluoverensstemmelser i EO-beregningen.',
      invariants: [buildControlMismatchInvariant(['Mismatch'])],
    });
  });

  it('tillader TAF-per-år-PDF ved warning-status uden output-blokering', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToTafPerYearDocument({
      ...snapshot,
      status: 'warning',
      invariants: [
        {
          id: 'warning:test',
          passed: false,
          severity: 'warning',
          source: 'validation' as const,
          message: 'Kun advarsel',
          blocksAuthoritativeComputation: false,
        },
      ],
      data: snapshot.data && {
        ...snapshot.data,
        engines: {
          ...snapshot.data.engines,
          tafPerYear: FAKE_TAF_PER_YEAR_RESULT,
        },
      },
    });

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') return;
    expect(projection.document.presentation).toBe(FAKE_TAF_PER_YEAR_RESULT);
  });

  it('blokerer TAF-per-år-PDF når der ikke beregnes TAF i erstatningsperioden', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToTafPerYearDocument(snapshot);

    expect(projection.kind).toBe('blocked');
    if (projection.kind !== 'blocked') return;
    expect(projection.message).toContain('der ikke beregnes tabt arbejdsfortjeneste i erstatningsperioden');
  });

  it('blokerer TAF-opreguleret-PDF når der ikke beregnes TAF i erstatningsperioden', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToTafPerYearOpreguleretDocument(snapshot);

    expect(projection.kind).toBe('blocked');
    if (projection.kind !== 'blocked') return;
    expect(projection.message).toContain('der ikke beregnes tabt arbejdsfortjeneste i erstatningsperioden');
  });

  it('tillader TAF-opreguleret-PDF og forwarder begge engine-resultater når der er TAF', () => {
    const snapshot = buildBaseSnapshot();
    const withTaf = {
      ...snapshot,
      data: snapshot.data && {
        ...snapshot.data,
        engines: { ...snapshot.data.engines, tafPerYear: FAKE_TAF_PER_YEAR_RESULT },
      },
    };
    const projection = eoSnapshotToTafPerYearOpreguleretDocument(withTaf);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') return;
    expect(projection.document.presentation).toBe(FAKE_TAF_PER_YEAR_RESULT);
    expect(projection.document.opreguleret).toBe(withTaf.data?.engines.tafPerYearOpreguleret ?? null);
  });

  it('manglende-reguleringssats-invariant blokerer KUN taf_per_year_opreguleret_pdf, ikke eo_pdf/taf_per_year_pdf', () => {
    const snapshot = buildBaseSnapshot();
    const invariant = buildTafPerYearOpreguleretManglendeReguleringssatsInvariant([2000, 2001]);
    const withInvariant = {
      ...snapshot,
      status: 'error' as const,
      invariants: [...snapshot.invariants, invariant],
      // Injicér TAF, så testen isolerer invariant-blokeringen og ikke rammer no-TAF-gaten.
      data: snapshot.data && {
        ...snapshot.data,
        engines: { ...snapshot.data.engines, tafPerYear: FAKE_TAF_PER_YEAR_RESULT },
      },
    };

    // Den opregulerede PDF blokeres med invariantens besked.
    const opreguleret = eoSnapshotToTafPerYearOpreguleretDocument(withInvariant);
    expect(opreguleret.kind).toBe('blocked');
    if (opreguleret.kind === 'blocked') {
      expect(opreguleret.invariants).toContain(invariant);
      expect(opreguleret.message).toContain('2000');
    }

    // De øvrige targets påvirkes IKKE af denne invariant.
    expect(eoSnapshotToEoDocument(withInvariant).kind).toBe('ok');
    expect(eoSnapshotToTafPerYearDocument(withInvariant).kind).toBe('ok');
  });
});
