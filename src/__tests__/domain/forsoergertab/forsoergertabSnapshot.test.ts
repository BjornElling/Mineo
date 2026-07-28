import { computeForsoergertabSnapshot } from '../../../domain/forsoergertab/forsoergertabSnapshot';
import * as forsoergertabCalculation from '../../../domain/forsoergertab/forsoergertabCalculation';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  StamdataValues,
} from '../../../schemas/formSchemas';

const asAmount = (value: number) => ({ kind: 'number' as const, value });

const createValues = (overrides: Partial<ForsoergertabValues> = {}): ForsoergertabValues => ({
  beregningsdato: toISODateString('2026-03-19'),
  efterladteFodselsdato: toISODateString('1973-01-01'),
  virkningsdato: toISODateString('2025-01-01'),
  koen: 'Kvinde',
  tilkendtForPeriodeAar: 10,
  ...overrides,
});

const createFaellesAarsloen = (overrides: Partial<FaellesAarsloenValues> = {}): FaellesAarsloenValues => ({
  aslAarsloen: asAmount(450000),
  ealAarsloen: asAmount(450000),
  ...overrides,
});

const createStamdata = (overrides: Partial<StamdataValues> = {}): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2020-05-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  ...overrides,
});

describe('computeForsoergertabSnapshot', () => {
  it('blokerer visning og PDF ved skadedato før fødselsdato uden monteret stamdata-side', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen(),
      stamdata: createStamdata({
        skadelidteFodselsdato: toISODateString('2021-01-01'),
        skadedato: toISODateString('2020-05-01'),
      }),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    expect(snapshot.canShowEal).toBe(false);
    expect(snapshot.canShowAsl).toBe(false);
    expect(snapshot.pdfGate.canDownload).toBe(false);
  });

  it('bygger én autoritativ visning og PDF-projektion fra samme beregningsresultat', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen(),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowAsl).toBe(true);
    expect(snapshot.canShowResult).toBe(true);
    expect(snapshot.pdfGate.canDownload).toBe(true);
    expect(snapshot.pdfProjection.result).toEqual(snapshot.calculation.result);
    expect(snapshot.pdfProjection.ealComputation).toEqual(snapshot.calculation.ealComputation);
    expect(snapshot.pdfProjection.aslComputation).toEqual(snapshot.calculation.aslComputation);
  });

  it('bevarer EAL-visning men blokerer ASL og download ved beregningsdato før virkningsdato', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues({
        beregningsdato: toISODateString('2020-01-01'),
        virkningsdato: toISODateString('2020-02-01'),
      }),
      faellesAarsloen: createFaellesAarsloen(),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowAsl).toBe(false);
    expect(snapshot.canShowResult).toBe(false);
    expect(snapshot.pdfGate.canDownload).toBe(false);
    expect(snapshot.pdfGate.reasons).toContainEqual(expect.objectContaining({
      code: 'forsoergertab:blocking-input-error',
    }));
    expect(snapshot.pdfProjection.ealComputation).not.toBeNull();
    expect(snapshot.pdfProjection.aslComputation).toBeNull();
    expect(snapshot.pdfProjection.result).toBeNull();
  });

  it('lader feltfejl overstyre domænehelpertekst i snapshot-projektionen', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen({
        ealAarsloen: undefined,
      }),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {
          ealAarsloen: { message: 'Feltfejl fra UI' },
        },
        stamdata: {},
      },
    });

    // Selve den røde markering vises af feltet fra readerens issue-snapshot; snapshottet ejer konsekvensen.
    expect(snapshot.canShowEal).toBe(false);
    expect(snapshot.pdfGate.canDownload).toBe(false);
    expect(snapshot.pdfProjection.ealComputation).toBeNull();
  });

  it('blokerer download når ASL-årsløn har feltfejl selv om EAL-delen kan beregnes', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen({
        aslAarsloen: asAmount(aarsloenAslMax[2020] + 1000),
        ealAarsloen: asAmount(450000),
      }),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {
          aslAarsloen: {
            message: 'Årsløn kan ikke overstige maks årslønnen i skadesåret (539.000 kr.)',
          },
        },
        stamdata: {},
      },
    });

    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowAsl).toBe(false);
    expect(snapshot.pdfGate.canDownload).toBe(false);
  });

  it('oplyser om ASL-maksimum uden at blokere, når tom EAL genbruger ASL-maksimum', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen({
        aslAarsloen: asAmount(aarsloenAslMax[2020]),
        ealAarsloen: undefined,
      }),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    // Beslutning 3 (GM-F05): oplysningen NÅR brugeren som en ikke-blokerende besked. Den var før udledt som
    // `fieldUi.ealAarsloen.helperText`, men intet læste den, så beskeden blev aldrig vist.
    expect(snapshot.ealAarsloenNotice).toBe(
      'Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.'
    );
    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowResult).toBe(true);
    expect(snapshot.pdfGate.canDownload).toBe(true);
    expect(snapshot.pdfProjection.ealComputation).not.toBeNull();
    expect(snapshot.pdfProjection.result).not.toBeNull();
  });

  it('oplyser om ASL-maksimum uden at blokere, når EAL-årsløn ER ASL-maksimum', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen({
        aslAarsloen: asAmount(450000),
        ealAarsloen: asAmount(aarsloenAslMax[2020]),
      }),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    // Beslutning 3 (GM-F05): oplysningen NÅR brugeren som en ikke-blokerende besked. Den var før udledt som
    // `fieldUi.ealAarsloen.helperText`, men intet læste den, så beskeden blev aldrig vist.
    expect(snapshot.ealAarsloenNotice).toBe(
      'Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.'
    );
    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowResult).toBe(true);
    expect(snapshot.pdfGate.canDownload).toBe(true);
    expect(snapshot.pdfProjection.ealComputation).not.toBeNull();
    expect(snapshot.pdfProjection.result).not.toBeNull();
  });

  it('projicerer dato-bounds til page-laget fra snapshot', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues({
        beregningsdato: toISODateString('2026-03-19'),
        virkningsdato: toISODateString('2025-01-01'),
      }),
      faellesAarsloen: createFaellesAarsloen(),
      stamdata: createStamdata({
        skadedato: toISODateString('2020-05-01'),
      }),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    expect(snapshot.inputBounds.skadedatoMin).toBe(toISODateString('2020-05-01'));
    expect(snapshot.inputBounds.beregningsdatoMin).toBe(toISODateString('2025-01-01'));
    expect(snapshot.inputBounds.virkningsdatoMax).toBe(toISODateString('2026-03-19'));
  });

  it('failer lukket med snapshot-issue hvis forsørgertabsberegningen kaster runtimefejl', () => {
    const spy = vi.spyOn(forsoergertabCalculation, 'computeForsoergertabCalculation').mockImplementation(() => {
      throw new Error('Injected FST failure');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const snapshot = computeForsoergertabSnapshot({
        values: createValues(),
        faellesAarsloen: createFaellesAarsloen(),
        stamdata: createStamdata(),
        fieldErrors: {
          forsoergertab: {},
          faellesAarsloen: {},
          stamdata: {},
        },
      });

      expect(snapshot.calculation.result).toBeNull();
      expect(snapshot.canShowResult).toBe(false);
      expect(snapshot.pdfGate.canDownload).toBe(false);
      expect(snapshot.calculation.issues).toContainEqual(expect.objectContaining({
        id: 'runtime-exception',
        severity: 'error',
      }));
    } finally {
      spy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});
