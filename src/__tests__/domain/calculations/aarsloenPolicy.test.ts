import type { AarsloenValues } from '../../../domain/policies/aarsloenPolicy';
import {
  resolveAarsloenDefaultLoenperiode,
  hasAarsloenEffectiveRows,
  shouldShowAarsloenFerieFields,
  shouldShowAarsloenShDageFields,
  shouldWarnAarsloenFeriePct,
} from '../../../domain/policies/aarsloenPolicy';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

// ─── Helpers ──────────────────────────────────────────────────────────────

const emptyTableRow = (id: string): StandardLoenTableRow => ({
  id,
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
});

const filledTableRow = (id: string): StandardLoenTableRow => ({
  ...emptyTableRow(id),
  col0_maaned: '6',
  col1_maaned: '2024',
});

const baseAarsloen = (patch: Partial<AarsloenValues> = {}): AarsloenValues => ({
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: 'maaned',
  tableData: [],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: false,
  retTilSjetteFerieuge: false,
  antalFeriedage: undefined,
  loenPaaHelligdage: 'Almindelig løn',
  ...patch,
} as AarsloenValues);

// ─── resolveAarsloenDefaultLoenperiode ────────────────────────────────────

describe('resolveAarsloenDefaultLoenperiode', () => {
  it('null → maaned (default)', () => {
    expect(resolveAarsloenDefaultLoenperiode(null)).toBe('maaned');
  });

  it('undefined loenperiode → maaned (default)', () => {
    // Bemærk: aarsloenSchema kræver altid en loenperiode, men vi tester edge case
    expect(resolveAarsloenDefaultLoenperiode(baseAarsloen({ loenperiode: undefined as unknown as 'maaned' }))).toBe('maaned');
  });

  it('uge → uge', () => {
    expect(resolveAarsloenDefaultLoenperiode(baseAarsloen({ loenperiode: 'uge' }))).toBe('uge');
  });

  it('dag → dag', () => {
    expect(resolveAarsloenDefaultLoenperiode(baseAarsloen({ loenperiode: 'dag' }))).toBe('dag');
  });

  it('maaned → maaned', () => {
    expect(resolveAarsloenDefaultLoenperiode(baseAarsloen({ loenperiode: 'maaned' }))).toBe('maaned');
  });
});

// ─── hasAarsloenEffectiveRows ─────────────────────────────────────────────

describe('hasAarsloenEffectiveRows', () => {
  it('null → false', () => {
    expect(hasAarsloenEffectiveRows(null)).toBe(false);
  });

  it('tom tableData → false', () => {
    expect(hasAarsloenEffectiveRows(baseAarsloen({ tableData: [] }))).toBe(false);
  });

  it('kun tomme rækker → false', () => {
    expect(hasAarsloenEffectiveRows(baseAarsloen({ tableData: [emptyTableRow('r1')] }))).toBe(false);
  });

  it('én udfyldt række → true', () => {
    expect(hasAarsloenEffectiveRows(baseAarsloen({ tableData: [filledTableRow('r1')] }))).toBe(true);
  });

  it('blanding af tomme og udfyldte → true', () => {
    const rows = [emptyTableRow('e1'), filledTableRow('r1'), emptyTableRow('e2')];
    expect(hasAarsloenEffectiveRows(baseAarsloen({ tableData: rows }))).toBe(true);
  });
});

// ─── shouldShowAarsloenFerieFields ────────────────────────────────────────

describe('shouldShowAarsloenFerieFields', () => {
  it('null → false', () => {
    expect(shouldShowAarsloenFerieFields(null)).toBe(false);
  });

  it('fuldLoenUnderFerie = false → true (vis ferie-felter)', () => {
    expect(shouldShowAarsloenFerieFields(baseAarsloen({ fuldLoenUnderFerie: false }))).toBe(true);
  });

  it('fuldLoenUnderFerie = true → false (skjul ferie-felter)', () => {
    expect(shouldShowAarsloenFerieFields(baseAarsloen({ fuldLoenUnderFerie: true }))).toBe(false);
  });
});

// ─── shouldShowAarsloenShDageFields ──────────────────────────────────────

describe('shouldShowAarsloenShDageFields', () => {
  it('null → false', () => {
    expect(shouldShowAarsloenShDageFields(null)).toBe(false);
  });

  it('Ingen → true', () => {
    expect(shouldShowAarsloenShDageFields(baseAarsloen({ loenPaaHelligdage: 'Ingen' }))).toBe(true);
  });

  it('SH-udbetaling → true', () => {
    expect(shouldShowAarsloenShDageFields(baseAarsloen({ loenPaaHelligdage: 'SH-udbetaling' }))).toBe(true);
  });

  it('Almindelig løn → false', () => {
    expect(shouldShowAarsloenShDageFields(baseAarsloen({ loenPaaHelligdage: 'Almindelig løn' }))).toBe(false);
  });
});

// ─── shouldWarnAarsloenFeriePct ───────────────────────────────────────────

describe('shouldWarnAarsloenFeriePct', () => {
  it('null → false', () => {
    expect(shouldWarnAarsloenFeriePct(null)).toBe(false);
  });

  it('feriePct = undefined → false', () => {
    expect(shouldWarnAarsloenFeriePct(baseAarsloen({ feriePct: undefined }))).toBe(false);
  });

  it('feriePct < 15 og fuldLoenUnderFerie = false og retTilSjetteFerieuge = false → false', () => {
    // WARN kræver feriePct >= 15
    expect(shouldWarnAarsloenFeriePct(baseAarsloen({
      feriePct: 14,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
    }))).toBe(false);
  });

  it('feriePct >= 15 og ikke fuld løn og ikke 6. ferieuge → true', () => {
    expect(shouldWarnAarsloenFeriePct(baseAarsloen({
      feriePct: 15,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
    }))).toBe(true);
  });

  it('feriePct = 20 → true', () => {
    expect(shouldWarnAarsloenFeriePct(baseAarsloen({
      feriePct: 20,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
    }))).toBe(true);
  });

  it('feriePct >= 15 men fuldLoenUnderFerie = true → false (ingen advarsel)', () => {
    expect(shouldWarnAarsloenFeriePct(baseAarsloen({
      feriePct: 15,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: false,
    }))).toBe(false);
  });

  it('feriePct >= 15 men retTilSjetteFerieuge = true → false (ingen advarsel)', () => {
    expect(shouldWarnAarsloenFeriePct(baseAarsloen({
      feriePct: 15,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: true,
    }))).toBe(false);
  });
});
