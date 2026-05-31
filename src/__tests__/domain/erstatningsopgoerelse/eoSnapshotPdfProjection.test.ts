
vi.mock('../../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
}));

import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument';
import { eoSnapshotToTafPerYearPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearPdfDocument';
import { buildControlMismatchInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { toISODateString } from '../../../types/branded';

const buildBaseSnapshot = () => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
  eoValues.vedroererPeriodeTil = toISODateString('2024-01-31');
  eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
  eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
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
      yearIncomeOre: 0 as MoneyOre,
      yearDeductionsOre: 0 as MoneyOre,
      yearTafFoerForligOre: 0 as MoneyOre,
      yearTafOre: 0 as MoneyOre,
    },
  ],
  sumYearTafOre: 0 as MoneyOre,
  afrundingOre: 0 as MoneyOre,
  samletTafKravOre: 0 as MoneyOre,
};

describe('EO snapshot PDF projections', () => {
  it('tillader EO-PDF ved warning-status uden eo_pdf-blokering', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToEoPdfDocument({
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
        },
      ],
    });

    expect(projection.kind).toBe('ok');
  });

  it('blokerer EO-PDF ved eo_pdf-blokerende invariant', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToEoPdfDocument({
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
    const projection = eoSnapshotToTafPerYearPdfDocument({
      ...snapshot,
      status: 'warning',
      invariants: [
        {
          id: 'warning:test',
          passed: false,
          severity: 'warning',
          source: 'validation' as const,
          message: 'Kun advarsel',
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

  it('tillader TAF-per-år-PDF uden TAF-perioder og giver null-praesentation', () => {
    const snapshot = buildBaseSnapshot();
    const projection = eoSnapshotToTafPerYearPdfDocument(snapshot);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') return;
    expect(projection.document.presentation).toBeNull();
    expect(projection.document.model.tabtArbejdsfortjeneste.harTafPerioder).toBe(false);
  });
});
