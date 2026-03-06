import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
}));

import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument';
import { eoSnapshotToTafPerYearPdfDocument } from '../../../domain/erstatningsopgoerelse/eoSnapshotToTafPerYearPdfDocument';
import { buildControlMismatchInvariant } from '../../../domain/erstatningsopgoerelse/eoSnapshotInvariants';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/tafPerYearDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/eoPdfModel';

const buildBaseSnapshot = () => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.vedroererPeriodeFra = '2024-01-01';
  eoValues.vedroererPeriodeTil = '2024-01-31';
  eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
  eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
  eoValues.oevrigeKravPerioder = [
    {
      id: 'krav-1',
      dato: '2024-01-15',
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

  it('blokerer EO-PDF hvis dokumentets totals divergerer fra snapshot', () => {
    const snapshot = buildBaseSnapshot();
    const tamperedSnapshot = {
      ...snapshot,
      data: snapshot.data && {
        ...snapshot.data,
        totals: {
          ...snapshot.data.totals,
          samletTotalOre: 999999 as MoneyOre,
        },
      },
    };

    const projection = eoSnapshotToEoPdfDocument(tamperedSnapshot);
    expect(projection).toEqual({
      kind: 'blocked',
      message: 'Dokumentmodellen matcher ikke snapshot-totalerne.',
      invariants: [
        expect.objectContaining({
          id: 'projection:document_totals_mismatch',
          message: 'Dokumentmodellen matcher ikke snapshot-totalerne.',
        }),
      ],
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
});
