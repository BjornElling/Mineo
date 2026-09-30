import { moneyOre } from '../../../domain/money/money';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { TafPerYearBuildOutcome, TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import type { TafPerYearOpreguleretBuildOutcome } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { EetImportContext } from '../../../domain/erhvervsevnetab/eetImportPort';
import { toISODateString } from '../../../types/branded';

const { tafOutcomeMock, opreguleretOutcomeMock, controlMismatchMock } = vi.hoisted(() => ({
  tafOutcomeMock: vi.fn(),
  opreguleretOutcomeMock: vi.fn(),
  controlMismatchMock: vi.fn(),
}));

vi.mock('../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived')>();
  return {
    ...actual,
    buildTafPerYearBuildOutcome: tafOutcomeMock,
  };
});

vi.mock('../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived')>();
  return {
    ...actual,
    buildTafPerYearOpreguleretBuildOutcome: opreguleretOutcomeMock,
  };
});

vi.mock('../../../domain/erstatningsopgoerelse/control/eoControlMismatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/control/eoControlMismatch')>();
  return {
    ...actual,
    collectSammentaellingControlMismatchMessages: controlMismatchMock,
  };
});

const buildValidTafValues = () => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
  eoValues.vedroererPeriodeTil = toISODateString('2024-06-30');
  eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
  eoValues.beregnesUdFra = 'Beregningsperiode';
  eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
  eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
  const employment = createDefaultLoenindkomstAnsaettelsesforhold();
  employment.navnPaaArbejdssted = 'Testarbejde';
  employment.loenudviklingBeregningsgrundlag = 'Ingen';
  eoValues.loenindkomstAnsaettelsesforhold = [employment];
  eoValues.sfggAnsaettelsesforhold = [{
    ansaettelsesforholdId: employment.id,
    sfggBeregningskilde: 'Ingen',
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: 0,
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  }];
  eoValues.tafPerioder = [
    { id: 'taf-branch', fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30'), loseFeriedage: 0 },
  ];
  return eoValues;
};

const tafPerYearResult: TafPerYearResult = {
  years: [{
    year: 2024,
    segments: [],
    deductions: [],
    yearIncomeOre: moneyOre(0),
    yearDeductionsOre: moneyOre(0),
    yearTidligereModtagetTafOre: moneyOre(0),
    yearTafFoerForligOre: moneyOre(0),
    yearTafOre: moneyOre(0),
  }],
  sumYearTafOre: moneyOre(0),
  afrundingOre: moneyOre(0),
  samletTafKravOre: moneyOre(0),
};

describe('computeEoSnapshot – direkte invariantbrancher', () => {
  beforeEach(() => {
    tafOutcomeMock.mockReset();
    opreguleretOutcomeMock.mockReset();
    controlMismatchMock.mockReset();
    opreguleretOutcomeMock.mockReturnValue({ kind: 'not_applicable' } satisfies TafPerYearOpreguleretBuildOutcome);
    controlMismatchMock.mockReturnValue([]);
  });

  it('samler schema-issues fra stamdata, når begge inputparser fejler', () => {
    const snapshot = computeEoSnapshot({
      revision: 'schema-begge-sektioner',
      stamdataValues: { skadestype: 123 } as never,
      eoValues: {} as never,
    });

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('schema_guard');
    expect(snapshot.invariants.length).toBeGreaterThan(1);
  });

  it('bevarer gyldig Stamdata ved schema-fejl i EO-sektionen', () => {
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      journalnr: 'TD-563',
      skadelidte: 'Gyldig Stamdata',
      skadestype: 'Arbejdsulykke' as const,
      skadedato: toISODateString('2024-01-01'),
    };
    const snapshot = computeEoSnapshot({
      revision: 'schema-eo-sektion',
      stamdataValues,
      eoValues: {} as never,
    });

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('schema_guard');
    expect(snapshot.input.stamdata).toEqual(expect.objectContaining({
      journalnr: 'TD-563',
      skadelidte: 'Gyldig Stamdata',
      skadestype: 'Arbejdsulykke',
      skadedato: toISODateString('2024-01-01'),
    }));
    expect(snapshot.input.erstatningsopgoerelse).toBeNull();
  });

  it('projekterer et gyldigt forlig til beregning og EO-PDF', () => {
    tafOutcomeMock.mockReturnValue({
      kind: 'not_applicable',
      reason: 'missing_loenudvikling',
    } satisfies TafPerYearBuildOutcome);

    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    eoValues.forligAnsvarsgradProcent = 50;

    const snapshot = computeEoSnapshot({
      revision: 'forlig-pdf-projection',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.data?.engines.forlig).toEqual({ factor: 0.5, label: '50 %' });
    expect(snapshot.data?.pdfModel.forlig).toEqual({
      erIndgaaet: true,
      label: '50 %',
      dato: null,
      factor: 0.5,
    });
  });

  it('bevarer en ikke-blokerende EET-advarsel som warning-status', () => {
    tafOutcomeMock.mockReturnValue({
      kind: 'not_applicable',
      reason: 'missing_loenudvikling',
    } satisfies TafPerYearBuildOutcome);

    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    eoValues.midlertidigtEetFraEetSiden = 'Ja';
    const midlertidigtEetImportContext: EetImportContext = {
      revision: 'eet-warning',
      groups: [],
      issues: [{ id: 'warning:test', severity: 'warning', message: 'EET-advarsel' }],
    };

    const snapshot = computeEoSnapshot({
      revision: 'eet-warning-status',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
      midlertidigtEetImportContext,
    });

    expect(snapshot.status).toBe('warning');
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'midlertidigt_eet_source:warning:test',
      severity: 'warning',
      blocksAuthoritativeComputation: false,
      blocksOutputs: [],
    }));
  });

  it('udleder TAF-utilgængelighed og kontrol-mismatch fra den byggede kontrolsnapshot', () => {
    tafOutcomeMock.mockReturnValue({ kind: 'not_applicable', reason: 'missing_loenudvikling' } satisfies TafPerYearBuildOutcome);
    controlMismatchMock.mockReturnValue(['TAF: beregnet afviger fra tabel']);

    const snapshot = computeEoSnapshot({
      revision: 'taf-branches-unavailable-mismatch',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: buildValidTafValues(),
    });

    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'taf_per_year:missing_loenudvikling',
    }));
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'control:sammentaelling_mismatch',
      evidence: ['TAF: beregnet afviger fra tabel'],
    }));
  });

  it('oversætter manglende opreguleringssats til en snapshot-invariant', () => {
    tafOutcomeMock.mockReturnValue({ kind: 'ok', result: tafPerYearResult } satisfies TafPerYearBuildOutcome);
    opreguleretOutcomeMock.mockReturnValue({
      kind: 'error',
      reason: 'manglende_reguleringssats',
      manglendeAar: [2022, 2023],
    } satisfies TafPerYearOpreguleretBuildOutcome);

    const snapshot = computeEoSnapshot({
      revision: 'taf-branch-manglende-sats',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: buildValidTafValues(),
    });

    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'taf_per_year_opreguleret:manglende_reguleringssats',
      message: expect.stringContaining('2022, 2023'),
    }));
  });

  it('oversætter for stor TAF-afrunding til en snapshot-invariant', () => {
    tafOutcomeMock.mockReturnValue({
      kind: 'error',
      reason: 'afrunding_over_100',
      afrundingOre: moneyOre(101),
      sumYearTafOre: moneyOre(9_899),
      samletTafKravOre: moneyOre(10_000),
    } satisfies TafPerYearBuildOutcome);

    const snapshot = computeEoSnapshot({
      revision: 'taf-branch-afrunding',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: buildValidTafValues(),
    });

    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'taf_per_year:afrunding_over_100',
      evidence: expect.arrayContaining(['Afrunding: 101']),
    }));
  });
});
