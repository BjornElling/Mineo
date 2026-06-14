import {
  initialRow,
  generateRowId,
  generateAnsaettelsesforholdId,
  generateOffentligYdelseRowId,
  generateLoenudviklingRowId,
  initialOffentligYdelseRow,
  initialLoenudviklingManuelRow,
} from '../../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import {
  loenudviklingManuelRowSchema,
  offentligeYdelserRowSchema,
  standardLoenTableRowSchema,
} from '../../../schemas/formSchemas';

// ─── initialRow ───────────────────────────────────────────────────────────────

describe('initialRow', () => {
  it('har tomt id', () => {
    expect(initialRow.id).toBe('');
  });

  it('tekstbaserede periodefelter er tomme strenge og datofelter er undefined', () => {
    expect(initialRow.col0_maaned).toBe('');
    expect(initialRow.col1_maaned).toBe('');
    expect(initialRow.col0_uge).toBe('');
    expect(initialRow.col1_uge).toBe('');
    expect(initialRow.col0_dag).toBeUndefined();
    expect(initialRow.col1_dag).toBeUndefined();
  });

  it('alle col-felter er undefined', () => {
    expect(initialRow.col2).toBeUndefined();
    expect(initialRow.col3).toBeUndefined();
    expect(initialRow.col4).toBeUndefined();
    expect(initialRow.col5).toBeUndefined();
  });

  it('er schema-gyldig når caller har sat et id (drift-værn mod schema-ændringer)', () => {
    const result = standardLoenTableRowSchema.safeParse({ ...initialRow, id: generateRowId() });
    expect(result.success).toBe(true);
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

  it('datofelter er undefined', () => {
    expect(initialOffentligYdelseRow.fraDato).toBeUndefined();
    expect(initialOffentligYdelseRow.tilDato).toBeUndefined();
  });

  it('ydelse og tillaeg er undefined', () => {
    expect(initialOffentligYdelseRow.ydelse).toBeUndefined();
    expect(initialOffentligYdelseRow.tillaeg).toBeUndefined();
  });

  it('ydelsestype er tom streng', () => {
    expect(initialOffentligYdelseRow.ydelsestype).toBe('');
  });

  it('er schema-gyldig når caller har sat et id (drift-værn mod schema-ændringer)', () => {
    const result = offentligeYdelserRowSchema.safeParse({
      ...initialOffentligYdelseRow,
      id: generateOffentligYdelseRowId(),
    });
    expect(result.success).toBe(true);
  });
});

// ─── initialLoenudviklingManuelRow ────────────────────────────────────────────

describe('initialLoenudviklingManuelRow', () => {
  it('id er tom streng', () => {
    expect(initialLoenudviklingManuelRow.id).toBe('');
  });

  it('dato er undefined', () => {
    expect(initialLoenudviklingManuelRow.dato).toBeUndefined();
  });

  it('alle sats-felter er undefined', () => {
    expect(initialLoenudviklingManuelRow.grundloen).toBeUndefined();
    expect(initialLoenudviklingManuelRow.feriepenge).toBeUndefined();
    expect(initialLoenudviklingManuelRow.shSoSats).toBeUndefined();
    expect(initialLoenudviklingManuelRow.fritvalg).toBeUndefined();
    expect(initialLoenudviklingManuelRow.agPension).toBeUndefined();
  });

  it('er schema-gyldig når caller har sat et id (drift-værn mod schema-ændringer)', () => {
    const result = loenudviklingManuelRowSchema.safeParse({
      ...initialLoenudviklingManuelRow,
      id: generateLoenudviklingRowId(),
    });
    expect(result.success).toBe(true);
  });
});
