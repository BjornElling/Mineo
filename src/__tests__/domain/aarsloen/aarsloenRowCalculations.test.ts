import {
  calculateStandardLoenRowDerived,
  calculateStandardLoenProjectedAmounts,
  roundStandardLoenAmountToTwoDecimals,
  isStandardLoenTableCellEffectivelyEmpty,
  isStandardLoenRowEffectivelyEmpty,
  hasCompletePeriodForLoenperiode,
  hasAtLeastOneValidRow,
  type StandardLoenSatserInput,
  type StandardLoenRateSegment,
} from '../../../domain/aarsloen/standardLoenRowCalculations';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

const createRow = (overrides: Partial<StandardLoenTableRow> = {}): StandardLoenTableRow => ({
  id: 'row-1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: '',
  col1_dag: '',
  col2: 0,
  col3: 0,
  col4: 0,
  col5: 0,
  ...overrides,
});

describe('calculateStandardLoenRowDerived — Store Bededag', () => {
  it('storeBededagPct indgår i fpFvShSo-grundlaget (beregnes af løn inkl. ikke-pens.giv.)', () => {
    // Verificerer at 0,45 % tillæg tilskrives korrekt:
    // loenPlusLoen2 = 30000, ikkePensionsgivende = 0, ferie = 12,5 %, bededag = 0,45 %
    // totalPct = 0.1295
    // fpFvShSo = 30000 × 0.1295 = 3885
    // pension  = 30000 × (1 + 0.1295) × 0 = 0
    const row = createRow({ col2: 30000, col3: 0, col4: 0, col5: 0 });
    const satser: StandardLoenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '0',
      shSoPct: '0',
      storeBededagPct: '0,45',
      pensionPct: '0',
    };
    const result = calculateStandardLoenRowDerived(row, satser);
    expect(result.fpFvShSo).toBeCloseTo(3885, 6);
  });

  it('storeBededagPct indgår i pensionsgrundlaget (pension beregnes af løn × (1 + alle tillæg))', () => {
    // pension = 30000 × (1 + (12,5 + 0,45)/100) × (10/100)
    //         = 30000 × 1.1295 × 0.10 = 3388.5
    const row = createRow({ col2: 30000, col3: 0, col4: 0, col5: 0 });
    const satser: StandardLoenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '0',
      shSoPct: '0',
      storeBededagPct: '0,45',
      pensionPct: '10',
    };
    const result = calculateStandardLoenRowDerived(row, satser);
    expect(result.pension).toBeCloseTo(3388.5, 6);
  });

  it('storeBededagPct = 0 giver samme resultat som at udelade feltet', () => {
    const row = createRow({ col2: 30000, col3: 2000, col4: 1000, col5: 300 });
    const medNul: StandardLoenSatserInput = {
      feriePct: '12,5', fritvalgPct: '1,0', shSoPct: '2,0', storeBededagPct: '0', pensionPct: '10,0',
    };
    const udenFelt: StandardLoenSatserInput = {
      feriePct: '12,5', fritvalgPct: '1,0', shSoPct: '2,0', storeBededagPct: undefined, pensionPct: '10,0',
    };
    const medNulResult = calculateStandardLoenRowDerived(row, medNul);
    const udenFeltResult = calculateStandardLoenRowDerived(row, udenFelt);
    expect(medNulResult.fpFvShSo).toBeCloseTo(udenFeltResult.fpFvShSo, 10);
    expect(medNulResult.pension).toBeCloseTo(udenFeltResult.pension, 10);
    expect(medNulResult.samlet).toBeCloseTo(udenFeltResult.samlet, 10);
  });
});

describe('calculateStandardLoenRowDerived', () => {
  it('beregner loenPlusLoen2, fp/fv/sh/so, pension og samlet korrekt', () => {
    const row = createRow({
      col2: 30000,
      col3: 2000,
      col4: 1000,
      col5: 300,
    });
    const satser: StandardLoenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '1,0',
      shSoPct: '2,0',
      storeBededagPct: '0,45',
      pensionPct: '10,0',
    };

    // totalPct = 0.1595
    // loenPlusLoen2 = 32000
    // loenPlusLoen2PlusIkkePensLoen = 33000
    // fpFvShSo = 33000 * 0.1595 = 5263.5
    // pension = 32000 * 1.1595 * 0.10 = 3710.4
    // samlet = 33000 + 5263.5 + 3710.4 + 300 = 42273.9
    const result = calculateStandardLoenRowDerived(row, satser);
    expect(result.loenPlusLoen2).toBe(32000);
    expect(result.loenPlusLoen2PlusIkkePensLoen).toBe(33000);
    expect(result.fpFvShSo).toBeCloseTo(5263.5, 6);
    expect(result.pension).toBeCloseTo(3710.4, 6);
    expect(result.samlet).toBeCloseTo(42273.9, 6);
  });

  it('medtager ATP direkte i samlet, men ikke i pensionsgrundlag', () => {
    const row = createRow({
      col2: 10000,
      col3: 5000,
      col4: 0,
      col5: 1000,
    });
    const satser: StandardLoenSatserInput = {
      feriePct: '0',
      fritvalgPct: '0',
      shSoPct: '0',
      storeBededagPct: '0',
      pensionPct: '10',
    };

    // loenPlusLoen2 = 15000, totalPct = 0
    // fpFvShSo = 0
    // pension = 15000 * 1 * 0.10 = 1500
    // samlet = 15000 + 0 + 1500 + 1000 = 17500
    const result = calculateStandardLoenRowDerived(row, satser);
    expect(result.fpFvShSo).toBe(0);
    expect(result.pension).toBe(1500);
    expect(result.samlet).toBe(17500);
  });

  it('behandler de to lønfelter ens og summerer dem blot i beregningen', () => {
    const satser: StandardLoenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '1,0',
      shSoPct: '2,0',
      storeBededagPct: '0,45',
      pensionPct: '10,0',
    };

    const samletICol2 = calculateStandardLoenRowDerived(createRow({ col2: 32000, col3: 0, col4: 1000, col5: 300 }), satser);
    const fordeltMellemBegge = calculateStandardLoenRowDerived(createRow({ col2: 30000, col3: 2000, col4: 1000, col5: 300 }), satser);

    expect(fordeltMellemBegge).toEqual(samletICol2);
  });

  it('ikke-pensionsgivende løn indgår i fpFvShSo-grundlaget men ikke i pensionsgrundlaget', () => {
    const row = createRow({
      col2: 149736,
      col3: 0,
      col4: 0,
      col5: 136,
    });
    const satser: StandardLoenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '0',
      shSoPct: '6,9',
      storeBededagPct: '0',
      pensionPct: '8,15',
    };

    // totalPct = 0.194
    // loenPlusLoen2 = 149736, loenPlusLoen2PlusIkkePensLoen = 149736
    // fpFvShSo = 149736 * 0.194 = 29048.784
    // pension = 149736 * 1.194 * 0.0815 = 14570.959896... (med col4=0 er de to grundlag identiske)
    const result = calculateStandardLoenRowDerived(row, satser);

    expect(result.fpFvShSo).toBeCloseTo(29048.784, 6);
    expect(result.pension).toBeCloseTo(14570.959896, 6);
    expect(result.samlet).toBeCloseTo(193491.743896, 6);
  });
});

describe('calculateStandardLoenRowDerived med rateSegments', () => {
  // Januar 2024 har 31 dage. Overenskomsten skifter sats pr. 16. januar:
  // segment A: 1–15 jan (15 dage), shSoPct = 2,0 %
  // segment B: 16–31 jan (16 dage), shSoPct = 6,9 %
  // share A = 15/31, share B = 16/31
  const satser: StandardLoenSatserInput = {
    feriePct: '0',
    fritvalgPct: '0',
    shSoPct: '0',
    storeBededagPct: '0',
    pensionPct: '0',
  };
  const rateSegments: StandardLoenRateSegment[] = [
    { fra: '2024-01-01', til: '2024-01-15', satser: { ...satser, shSoPct: '2,0' } },
    { fra: '2024-01-16', til: '2024-01-31', satser: { ...satser, shSoPct: '6,9' } },
  ];
  const row = createRow({
    col0_maaned: '1',
    col1_maaned: '2024',
    col2: 31000,
  });

  it('fordeler beregningen proportionalt på segmenter ved sats-skift midt i måneden', () => {
    const result = calculateStandardLoenRowDerived(row, satser, {
      loenperiode: 'maaned',
      rateSegments,
    });

    // loenPlusLoen2 = 31000 (uberørt af sats-skift)
    expect(result.loenPlusLoen2).toBe(31000);

    // fpFvShSo = (31000 * 15/31 * 0.02) + (31000 * 16/31 * 0.069)
    //          = (15000 * 0.02) + (16000 * 0.069)
    //          = 300 + 1104 = 1404
    // Råsummen er et præcist heltal her, så afrundingen ændrer intet —
    // men vi asserter med toBe for at håndhæve at output altid er afrundet til 2 decimaler.
    const expectedFpFvShSo = roundStandardLoenAmountToTwoDecimals(
      (31000 * (15 / 31)) * 0.02 + (31000 * (16 / 31)) * 0.069
    );
    expect(result.fpFvShSo).toBe(expectedFpFvShSo);
  });

  it('afrunder segmenteret pension og samlet til kanoniske 2 decimaler efter summering', () => {
    const roundedSatser: StandardLoenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '1,0',
      shSoPct: '0',
      storeBededagPct: '0',
      pensionPct: '10,0',
    };
    const roundedSegments: StandardLoenRateSegment[] = [
      { fra: '2024-01-01', til: '2024-01-15', satser: { ...roundedSatser, shSoPct: '2,0' } },
      { fra: '2024-01-16', til: '2024-01-31', satser: { ...roundedSatser, shSoPct: '6,9' } },
    ];
    const roundedRow = createRow({
      col0_maaned: '1',
      col1_maaned: '2024',
      col2: 10001,
      col4: 99,
      col5: 33,
    });

    const result = calculateStandardLoenRowDerived(roundedRow, roundedSatser, {
      loenperiode: 'maaned',
      rateSegments: roundedSegments,
    });

    const segment1Share = 15 / 31;
    const segment2Share = 16 / 31;
    const segment1TotalPct = 0.125 + 0.01 + 0.02;
    const segment2TotalPct = 0.125 + 0.01 + 0.069;
    const expectedLoenPlusLoen2 = roundStandardLoenAmountToTwoDecimals((10001 * segment1Share) + (10001 * segment2Share));
    const expectedLoenPlusLoen2PlusIkkePensLoen = roundStandardLoenAmountToTwoDecimals(
      ((10001 + 99) * segment1Share) + ((10001 + 99) * segment2Share)
    );
    const expectedFpFvShSo = roundStandardLoenAmountToTwoDecimals(
      ((10001 + 99) * segment1Share * segment1TotalPct) + ((10001 + 99) * segment2Share * segment2TotalPct)
    );
    const expectedPension = roundStandardLoenAmountToTwoDecimals(
      ((10001 * segment1Share) * (1 + segment1TotalPct) * 0.10)
      + ((10001 * segment2Share) * (1 + segment2TotalPct) * 0.10)
    );
    const expectedSamlet = roundStandardLoenAmountToTwoDecimals(
      (((10001 + 99) * segment1Share) + ((10001 + 99) * segment2Share))
      + (((10001 + 99) * segment1Share * segment1TotalPct) + ((10001 + 99) * segment2Share * segment2TotalPct))
      + (((10001 * segment1Share) * (1 + segment1TotalPct) * 0.10) + ((10001 * segment2Share) * (1 + segment2TotalPct) * 0.10))
      + 33
    );

    expect(result.loenPlusLoen2).toBe(expectedLoenPlusLoen2);
    expect(result.loenPlusLoen2PlusIkkePensLoen).toBe(expectedLoenPlusLoen2PlusIkkePensLoen);
    expect(result.fpFvShSo).toBe(expectedFpFvShSo);
    expect(result.pension).toBe(expectedPension);
    expect(result.samlet).toBe(expectedSamlet);
  });

  it('falder tilbage til basessatser hvis rateSegments er tomt', () => {
    const baseSatser: StandardLoenSatserInput = { ...satser, shSoPct: '5,0' };
    const result = calculateStandardLoenRowDerived(row, baseSatser, {
      loenperiode: 'maaned',
      rateSegments: [],
    });
    // Ingen segmenter → brug baseSatser direkte
    expect(result.fpFvShSo).toBeCloseTo(31000 * 0.05, 6);
  });

  it('falder tilbage til basessatser uden loenperiode, selv med rateSegments', () => {
    const baseSatser: StandardLoenSatserInput = { ...satser, shSoPct: '5,0' };
    const result = calculateStandardLoenRowDerived(row, baseSatser, {
      rateSegments,
    });
    // Ingen loenperiode → kan ikke parse interval → brug baseSatser
    expect(result.fpFvShSo).toBeCloseTo(31000 * 0.05, 6);
  });
});

describe('calculateStandardLoenProjectedAmounts', () => {
  it('summerer valgte dage med de satser der gælder på de enkelte dage', () => {
    const row = createRow({
      col0_dag: '26-02-2024',
      col1_dag: '05-03-2024',
      col2: 900,
    });
    const satser: StandardLoenSatserInput = {
      feriePct: 16.95,
      fritvalgPct: 0,
      shSoPct: 6.9,
      storeBededagPct: 0,
      pensionPct: 8.15,
    };

    const result = calculateStandardLoenProjectedAmounts(row, satser, {
      loenperiode: 'dag',
      allocationDates: [
        '2024-02-26',
        '2024-02-27',
        '2024-02-28',
        '2024-02-29',
        '2024-03-01',
        '2024-03-02',
        '2024-03-03',
        '2024-03-04',
        '2024-03-05',
      ],
      selectedDates: [
        '2024-03-01',
        '2024-03-02',
        '2024-03-03',
        '2024-03-04',
        '2024-03-05',
      ],
      rateSegments: [
        {
          fra: '2024-02-26',
          til: '2024-02-29',
          satser: { ...satser, shSoPct: 7.0 },
        },
        {
          fra: '2024-03-01',
          til: '2024-03-05',
          satser: { ...satser, shSoPct: 8.8 },
        },
      ],
    });

    expect(result.grundloen).toBeCloseTo(500, 8);
    expect(result.fpFvShSo).toBeCloseTo(128.75, 8);
    expect(result.pension).toBeCloseTo(51.243125, 8);
    expect(result.samlet).toBeCloseTo(679.993125, 8);
  });
});

// ─── roundStandardLoenAmountToTwoDecimals ────────────────────────────────────────

describe('roundStandardLoenAmountToTwoDecimals', () => {
  it('afrunder til 2 decimaler med halfAwayFromZero', () => {
    // 1.005 er i floating-point faktisk 1.004999... → afrunder ned til 1.00
    expect(roundStandardLoenAmountToTwoDecimals(1.005)).toBe(1);
    // 2.005 er i floating-point faktisk 2.005000... → afrunder op til 2.01
    expect(roundStandardLoenAmountToTwoDecimals(2.005)).toBe(2.01);
    expect(roundStandardLoenAmountToTwoDecimals(1.234)).toBe(1.23);
    expect(roundStandardLoenAmountToTwoDecimals(1.235)).toBe(1.24);
  });

  it('NaN → 0 (fail-closed)', () => {
    expect(roundStandardLoenAmountToTwoDecimals(Number.NaN)).toBe(0);
  });

  it('Infinity → 0 (fail-closed)', () => {
    expect(roundStandardLoenAmountToTwoDecimals(Number.POSITIVE_INFINITY)).toBe(0);
    expect(roundStandardLoenAmountToTwoDecimals(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('heltal er uændret', () => {
    expect(roundStandardLoenAmountToTwoDecimals(42)).toBe(42);
    expect(roundStandardLoenAmountToTwoDecimals(0)).toBe(0);
  });
});

// ─── isStandardLoenTableCellEffectivelyEmpty ─────────────────────────────────────

describe('isStandardLoenTableCellEffectivelyEmpty', () => {
  it('undefined → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty(undefined)).toBe(true);
  });

  it('null → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty(null)).toBe(true);
  });

  it('tom streng → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty('')).toBe(true);
  });

  it('whitespace-streng → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty('   ')).toBe(true);
  });

  it('streng med indhold → false', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty('01-2024')).toBe(false);
    expect(isStandardLoenTableCellEffectivelyEmpty('1')).toBe(false);
  });

  it('tal (0) → false (kun strenge er "empty")', () => {
    // Implementeringen returnerer false for ikke-strenge (typeof value !== 'string')
    expect(isStandardLoenTableCellEffectivelyEmpty(0)).toBe(false);
  });

  it('tal (1000) → false', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty(1000)).toBe(false);
  });
});

// ─── isStandardLoenRowEffectivelyEmpty ───────────────────────────────────────────

describe('isStandardLoenRowEffectivelyEmpty', () => {
  it('alle editable felter undefined → true', () => {
    const row: StandardLoenTableRow = {
      id: 'r',
      col0_maaned: undefined,
      col1_maaned: undefined,
      col0_uge: undefined,
      col1_uge: undefined,
      col0_dag: undefined,
      col1_dag: undefined,
      col2: undefined,
      col3: undefined,
      col4: undefined,
      col5: undefined,
    };
    expect(isStandardLoenRowEffectivelyEmpty(row)).toBe(true);
  });

  it('alle editable felter er tomme strings og undefined → true', () => {
    const row: StandardLoenTableRow = {
      id: 'r',
      col0_maaned: '',
      col1_maaned: '',
      col0_uge: '',
      col1_uge: '',
      col0_dag: '',
      col1_dag: '',
      col2: undefined,
      col3: undefined,
      col4: undefined,
      col5: undefined,
    };
    expect(isStandardLoenRowEffectivelyEmpty(row)).toBe(true);
  });

  it('createRow() med col2=0 (number) → false (0 er tal, ikke string)', () => {
    // col2: 0 → typeof number → isStandardLoenTableCellEffectivelyEmpty(0) = false
    expect(isStandardLoenRowEffectivelyEmpty(createRow({ col2: 0 }))).toBe(false);
  });

  it('row med col0_maaned = "1" og undefined numerics → ikke empty', () => {
    const row: StandardLoenTableRow = { id: 'r', col0_maaned: '1', col2: undefined, col3: undefined, col4: undefined, col5: undefined };
    expect(isStandardLoenRowEffectivelyEmpty(row)).toBe(false);
  });
});

// ─── hasCompletePeriodForLoenperiode ─────────────────────────────────────────

describe('hasCompletePeriodForLoenperiode', () => {
  it('maaned: begge felter sat → true', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'maaned')).toBe(true);
  });

  it('maaned: kun fra-felt sat → false', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '' });
    expect(hasCompletePeriodForLoenperiode(row, 'maaned')).toBe(false);
  });

  it('uge: begge felter sat → true', () => {
    const row = createRow({ col0_uge: '1/2024', col1_uge: '12/2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'uge')).toBe(true);
  });

  it('uge: ingen felter sat → false', () => {
    const row = createRow();
    expect(hasCompletePeriodForLoenperiode(row, 'uge')).toBe(false);
  });

  it('dag: begge felter sat → true', () => {
    const row = createRow({ col0_dag: '01-01-2024', col1_dag: '31-01-2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'dag')).toBe(true);
  });

  it('dag: kun til-felt sat → false', () => {
    const row = createRow({ col0_dag: '', col1_dag: '31-01-2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'dag')).toBe(false);
  });
});

// ─── hasAtLeastOneValidRow ───────────────────────────────────────────────────

describe('hasAtLeastOneValidRow', () => {
  const satser: StandardLoenSatserInput = { feriePct: '0', fritvalgPct: '0', shSoPct: '0', storeBededagPct: '0', pensionPct: '0' };

  it('tom liste → false', () => {
    expect(hasAtLeastOneValidRow([], 'maaned', satser)).toBe(false);
  });

  it('row med komplet periode og samlet > 0 → true', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '2024', col2: 10000 });
    expect(hasAtLeastOneValidRow([row], 'maaned', satser)).toBe(true);
  });

  it('row med komplet periode men samlet = 0 → false', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '2024', col2: 0, col3: 0, col4: 0, col5: 0 });
    expect(hasAtLeastOneValidRow([row], 'maaned', satser)).toBe(false);
  });

  it('row uden komplet periode → false', () => {
    const row = createRow({ col0_maaned: '1', col2: 10000 }); // col1_maaned mangler
    expect(hasAtLeastOneValidRow([row], 'maaned', satser)).toBe(false);
  });

  it('blandet liste: én gyldig og én ugyldig → true', () => {
    const valid = createRow({ col0_maaned: '1', col1_maaned: '2024', col2: 5000 });
    const invalid = createRow({ col0_maaned: '2' }); // ingen col1_maaned
    expect(hasAtLeastOneValidRow([invalid, valid], 'maaned', satser)).toBe(true);
  });
});
