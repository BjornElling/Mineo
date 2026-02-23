import { describe, expect, it } from 'vitest';
import type { AarsloenTableRow } from '../../schemas/formSchemas';
import {
  beregnFejlmeddelelser,
  harTabelValideringsFejl,
  harTabelData,
} from '../../utils/aarsloenValidation';

// ─── Helpers ──────────────────────────────────────────────────────────────

const emptyRow = (id: string): AarsloenTableRow => ({
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

const maanedRow = (id: string, month: string, year: string): AarsloenTableRow => ({
  ...emptyRow(id),
  col0_maaned: month,
  col1_maaned: year,
});

const ugeRow = (id: string, fra: string, til: string): AarsloenTableRow => ({
  ...emptyRow(id),
  col0_uge: fra,
  col1_uge: til,
});

const dagRow = (id: string, fra: string, til: string): AarsloenTableRow => ({
  ...emptyRow(id),
  col0_dag: fra,
  col1_dag: til,
});

// ─── beregnFejlmeddelelser ────────────────────────────────────────────────

describe('beregnFejlmeddelelser', () => {
  describe('ingen fejl (typisk valide kombinationer)', () => {
    it('0% ferie, ingen fuld løn, ingen SH-udbetaling → ingen fejl', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, false, 'Ingen');
      expect(errors).toHaveLength(0);
    });

    it('undefined pct, fuld løn under ferie → ingen fejl', () => {
      const errors = beregnFejlmeddelelser(undefined, undefined, true, false, 'Almindelig løn');
      expect(errors).toHaveLength(0);
    });
  });

  describe('FEJL 1: høj feriepct med fuld løn', () => {
    it('feriePct >= 12 OG fuld løn → fejl', () => {
      const errors = beregnFejlmeddelelser(12, 0, true, false, 'Almindelig løn');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some(e => e.includes('feriepengesats'))).toBe(true);
    });

    it('feriePct = 12.5 med fuld løn → fejl', () => {
      const errors = beregnFejlmeddelelser(12.5, 0, true, false, 'Almindelig løn');
      expect(errors.some(e => e.includes('feriepengesats'))).toBe(true);
    });

    it('feriePct = 11.9 med fuld løn → ingen FEJL 1', () => {
      const errors = beregnFejlmeddelelser(11.9, 0, true, false, 'Almindelig løn');
      expect(errors.filter(e => e.includes('fuld løn under ferie'))).toHaveLength(0);
    });
  });

  describe('FEJL 2: lav feriepct uden fuld løn', () => {
    it('feriePct > 0 og < 12 uden fuld løn → fejl', () => {
      const errors = beregnFejlmeddelelser(5, 0, false, false, 'Almindelig løn');
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('feriePct = 0 uden fuld løn → ingen FEJL 2', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, false, 'Almindelig løn');
      expect(errors).toHaveLength(0);
    });

    it('feriePct = 12 uden fuld løn → ingen FEJL 2 (grænseværdi)', () => {
      const errors = beregnFejlmeddelelser(12, 0, false, false, 'Almindelig løn');
      // FEJL 2 kræver > 0 og < 12.0 — 12.0 er præcis grænsen
      const fejl2 = errors.filter(e => e.includes('fuld løn under ferie'));
      expect(fejl2).toHaveLength(0);
    });
  });

  describe('FEJL 3: høj SH-sats', () => {
    it('shSoPct > 2.5 med Almindelig løn → fejl', () => {
      const errors = beregnFejlmeddelelser(0, 3, false, false, 'Almindelig løn');
      expect(errors.some(e => e.includes('SH/SO-sats'))).toBe(true);
    });

    it('shSoPct > 2.5 med Ingen → fejl', () => {
      const errors = beregnFejlmeddelelser(0, 3, false, false, 'Ingen');
      expect(errors.some(e => e.includes('SH/SO-sats'))).toBe(true);
    });

    it('shSoPct = 2.5 → ingen FEJL 3', () => {
      const errors = beregnFejlmeddelelser(0, 2.5, false, false, 'Ingen');
      expect(errors.filter(e => e.includes('SH/SO-sats'))).toHaveLength(0);
    });
  });

  describe('FEJL 4: lav SH-sats med SH-udbetaling', () => {
    it('shSoPct > 0 og < 2.5 med SH-udbetaling → fejl', () => {
      const errors = beregnFejlmeddelelser(0, 1, false, false, 'SH-udbetaling');
      expect(errors.some(e => e.includes('SH/SO-sats'))).toBe(true);
    });

    it('shSoPct = 0 med SH-udbetaling → ingen FEJL 4', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, false, 'SH-udbetaling');
      expect(errors.filter(e => e.includes('SH/SO-sats'))).toHaveLength(0);
    });
  });

  describe('FEJL 5: 6. ferieuge med lav feriepct', () => {
    it('6. ferieuge + feriePct 12% uden fuld løn → fejl', () => {
      const errors = beregnFejlmeddelelser(12, 0, false, true, 'Almindelig løn');
      expect(errors.some(e => e.includes('6. ferieuge'))).toBe(true);
    });

    it('6. ferieuge + feriePct = 15 → ingen FEJL 5', () => {
      const errors = beregnFejlmeddelelser(15, 0, false, true, 'Almindelig løn');
      expect(errors.filter(e => e.includes('6. ferieuge'))).toHaveLength(0);
    });

    it('6. ferieuge + feriePct = 0 → ingen FEJL 5 (0 er ikke > 0)', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, true, 'Almindelig løn');
      expect(errors.filter(e => e.includes('6. ferieuge'))).toHaveLength(0);
    });

    it('6. ferieuge + fuld løn → ingen FEJL 5', () => {
      const errors = beregnFejlmeddelelser(12, 0, true, true, 'Almindelig løn');
      expect(errors.filter(e => e.includes('6. ferieuge'))).toHaveLength(0);
    });
  });

  describe('multiple fejl kan forekomme', () => {
    it('kombinationen høj SH + lav ferie giver 2 fejl', () => {
      // shSoPct = 3 > 2.5 → FEJL 3
      // feriePct = 5, ikke fuld løn → FEJL 2
      const errors = beregnFejlmeddelelser(5, 3, false, false, 'Almindelig løn');
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ─── harTabelValideringsFejl ──────────────────────────────────────────────
// NB: harTabelValideringsFejl bruger getAarsloenTableValidation uden cellErrorsByCellKey.
// Fejl opstår kun ved "delvis periode" (nogen felter udfyldt, men ikke alle).
// Individuelle felt-format-fejl kræver at cellErrorsByCellKey sendes (hvilket sker i UI).

describe('harTabelValideringsFejl', () => {
  it('tom liste → false', () => {
    expect(harTabelValideringsFejl([], 'maaned')).toBe(false);
  });

  it('kun tomme rækker → false', () => {
    expect(harTabelValideringsFejl([emptyRow('r1')], 'maaned')).toBe(false);
  });

  it('komplet månedsrække → false', () => {
    expect(harTabelValideringsFejl([maanedRow('r1', '6', '2024')], 'maaned')).toBe(false);
  });

  it('komplet dagrække → false', () => {
    expect(harTabelValideringsFejl([dagRow('r1', '01-01-2024', '31-01-2024')], 'dag')).toBe(false);
  });

  it('delvis månedsrække (kun startdato) → true (partial period error)', () => {
    // Kun col0_maaned er udfyldt, col1_maaned mangler → partial period error
    const partialRow: AarsloenTableRow = { ...emptyRow('r1'), col0_maaned: '6' };
    expect(harTabelValideringsFejl([partialRow], 'maaned')).toBe(true);
  });

  it('delvis dagrække (kun fra) → true', () => {
    const partialRow: AarsloenTableRow = { ...emptyRow('r1'), col0_dag: '01-01-2024' };
    expect(harTabelValideringsFejl([partialRow], 'dag')).toBe(true);
  });

  it('delvis ugerække (kun fra) → true', () => {
    const partialRow: AarsloenTableRow = { ...emptyRow('r1'), col0_uge: '1/2024' };
    expect(harTabelValideringsFejl([partialRow], 'uge')).toBe(true);
  });
});

// ─── harTabelData ─────────────────────────────────────────────────────────

describe('harTabelData', () => {
  it('tom liste → false', () => {
    expect(harTabelData([], 'maaned')).toBe(false);
  });

  it('kun tomme rækker → false', () => {
    expect(harTabelData([emptyRow('r1')], 'maaned')).toBe(false);
  });

  it('komplet månedsrække → true', () => {
    expect(harTabelData([maanedRow('r1', '6', '2024')], 'maaned')).toBe(true);
  });

  it('komplet ugerække → true', () => {
    expect(harTabelData([ugeRow('r1', '1/2024', '4/2024')], 'uge')).toBe(true);
  });

  it('komplet dagrække → true', () => {
    expect(harTabelData([dagRow('r1', '01-01-2024', '31-01-2024')], 'dag')).toBe(true);
  });

  it('lønperiode mismatch: månedsdata med dag-lønperiode → false', () => {
    // Månedsdata (col0_maaned/col1_maaned) men lønperiode = dag
    expect(harTabelData([maanedRow('r1', '6', '2024')], 'dag')).toBe(false);
  });
});
