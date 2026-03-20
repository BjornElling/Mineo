import {
  initialRow,
  generateRowId,
  generateAnsaettelsesforholdId,
  generateOffentligYdelseRowId,
  generateLoenudviklingRowId,
  initialOffentligYdelseRow,
  initialLoenudviklingManuelRow,
} from '../../../domain/erstatningsopgoerelse/eoRowInitialValues';

// ─── initialRow ───────────────────────────────────────────────────────────────

describe('initialRow', () => {
  it('har tomt id', () => {
    expect(initialRow.id).toBe('');
  });

  it('alle periode-felter er tomme strenge', () => {
    expect(initialRow.col0_maaned).toBe('');
    expect(initialRow.col1_maaned).toBe('');
    expect(initialRow.col0_uge).toBe('');
    expect(initialRow.col1_uge).toBe('');
    expect(initialRow.col0_dag).toBe('');
    expect(initialRow.col1_dag).toBe('');
  });

  it('alle col-felter er undefined', () => {
    expect(initialRow.col2).toBeUndefined();
    expect(initialRow.col3).toBeUndefined();
    expect(initialRow.col4).toBeUndefined();
    expect(initialRow.col5).toBeUndefined();
  });
});

// ─── generateRowId ────────────────────────────────────────────────────────────

describe('generateRowId', () => {
  it('returnerer en streng', () => {
    expect(typeof generateRowId()).toBe('string');
  });

  it('returnerer unikke IDs', () => {
    const ids = Array.from({ length: 50 }, () => generateRowId());
    const unique = new Set(ids);
    expect(unique.size).toBe(50);
  });

  it('starter med "row_"', () => {
    expect(generateRowId()).toMatch(/^row_/);
  });
});

// ─── generateAnsaettelsesforholdId ────────────────────────────────────────────

describe('generateAnsaettelsesforholdId', () => {
  it('returnerer en streng', () => {
    expect(typeof generateAnsaettelsesforholdId()).toBe('string');
  });

  it('returnerer unikke IDs', () => {
    const ids = Array.from({ length: 20 }, () => generateAnsaettelsesforholdId());
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });

  it('starter med "ansaettelsesforhold_"', () => {
    expect(generateAnsaettelsesforholdId()).toMatch(/^ansaettelsesforhold_/);
  });
});

// ─── generateOffentligYdelseRowId ─────────────────────────────────────────────

describe('generateOffentligYdelseRowId', () => {
  it('returnerer en streng', () => {
    expect(typeof generateOffentligYdelseRowId()).toBe('string');
  });

  it('starter med "offentlig_ydelse_"', () => {
    expect(generateOffentligYdelseRowId()).toMatch(/^offentlig_ydelse_/);
  });

  it('returnerer unikke IDs', () => {
    const ids = Array.from({ length: 20 }, () => generateOffentligYdelseRowId());
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });
});

// ─── generateLoenudviklingRowId ───────────────────────────────────────────────

describe('generateLoenudviklingRowId', () => {
  it('returnerer en streng', () => {
    expect(typeof generateLoenudviklingRowId()).toBe('string');
  });

  it('starter med "loenudvikling_"', () => {
    expect(generateLoenudviklingRowId()).toMatch(/^loenudvikling_/);
  });

  it('returnerer unikke IDs', () => {
    const ids = Array.from({ length: 20 }, () => generateLoenudviklingRowId());
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });
});

// ─── initialOffentligYdelseRow ────────────────────────────────────────────────

describe('initialOffentligYdelseRow', () => {
  it('id er tom streng', () => {
    expect(initialOffentligYdelseRow.id).toBe('');
  });

  it('datofelter er tomme strenge', () => {
    expect(initialOffentligYdelseRow.fraDato).toBe('');
    expect(initialOffentligYdelseRow.tilDato).toBe('');
  });

  it('ydelse og tillaeg er undefined', () => {
    expect(initialOffentligYdelseRow.ydelse).toBeUndefined();
    expect(initialOffentligYdelseRow.tillaeg).toBeUndefined();
  });

  it('ydelsestype er tom streng', () => {
    expect(initialOffentligYdelseRow.ydelsestype).toBe('');
  });
});

// ─── initialLoenudviklingManuelRow ────────────────────────────────────────────

describe('initialLoenudviklingManuelRow', () => {
  it('id er tom streng', () => {
    expect(initialLoenudviklingManuelRow.id).toBe('');
  });

  it('dato er tom streng', () => {
    expect(initialLoenudviklingManuelRow.dato).toBe('');
  });

  it('alle sats-felter er undefined', () => {
    expect(initialLoenudviklingManuelRow.grundloen).toBeUndefined();
    expect(initialLoenudviklingManuelRow.feriepenge).toBeUndefined();
    expect(initialLoenudviklingManuelRow.shSoSats).toBeUndefined();
    expect(initialLoenudviklingManuelRow.fritvalg).toBeUndefined();
    expect(initialLoenudviklingManuelRow.agPension).toBeUndefined();
  });
});
