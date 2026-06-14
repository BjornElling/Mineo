import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import {
  buildOffentligeYdelserCellKey,
  getOffentligeYdelserRowFilledState,
  getOffentligeYdelserTableValidation,
  isOffentligeYdelserAmountValueValidForValidation,
  isOffentligeYdelserTableValueEffectivelyEmptyForValidation,
  parseOffentligeYdelserCellKey,
} from '../../../domain/erstatningsopgoerelse/validation/offentligeYdelserTableValidation';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });
const expr = (value: number, expression: string): AmountValue => ({ kind: 'expression', value, expression });

const makeRow = (patch: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  id: 'row-1',
  fraDato: undefined,
  tilDato: undefined,
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: undefined,
  ...patch,
});

describe('offentligeYdelserTableValidation', () => {
  describe('isOffentligeYdelserAmountValueValidForValidation', () => {
    it('accepterer undefined og null (tomt felt)', () => {
      expect(isOffentligeYdelserAmountValueValidForValidation(undefined)).toBe(true);
      expect(isOffentligeYdelserAmountValueValidForValidation(null)).toBe(true);
    });

    it('accepterer et gyldigt number-beløb', () => {
      expect(isOffentligeYdelserAmountValueValidForValidation(amount(1000))).toBe(true);
    });

    it('afviser et expression-beløb med tom udtryksstreng', () => {
      expect(isOffentligeYdelserAmountValueValidForValidation(expr(0, '   '))).toBe(false);
    });

    it('accepterer et expression-beløb med ikke-tom udtryksstreng', () => {
      expect(isOffentligeYdelserAmountValueValidForValidation(expr(3000, '1000+2000'))).toBe(true);
    });

    it('afviser et beløb med ikke-finite værdi', () => {
      expect(isOffentligeYdelserAmountValueValidForValidation({ kind: 'number', value: Number.NaN })).toBe(false);
    });
  });

  describe('isOffentligeYdelserTableValueEffectivelyEmptyForValidation', () => {
    it('behandler undefined, tom streng og rene nul-strenge som tomme', () => {
      expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation(undefined)).toBe(true);
      expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation('')).toBe(true);
      expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation('0')).toBe(true);
    });

    it('behandler et ikke-tomt number-beløb som ikke-tomt', () => {
      expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation(amount(500))).toBe(false);
    });

    it('behandler et expression-beløb med tom udtryksstreng som tomt', () => {
      expect(isOffentligeYdelserTableValueEffectivelyEmptyForValidation(expr(0, ''))).toBe(true);
    });
  });

  describe('buildOffentligeYdelserCellKey / parseOffentligeYdelserCellKey', () => {
    it('round-tripper rowId og kolonne', () => {
      const key = buildOffentligeYdelserCellKey('row-42', 'ydelse');
      expect(key).toBe('row-42:ydelse');
      expect(parseOffentligeYdelserCellKey(key)).toEqual({ rowId: 'row-42', colKey: 'ydelse' });
    });
  });

  describe('getOffentligeYdelserRowFilledState', () => {
    it('markerer en fuldt udfyldt række som komplet', () => {
      const state = getOffentligeYdelserRowFilledState(
        makeRow({ fraDato: iso('2024-01-01'), tilDato: iso('2024-01-31'), ydelsestype: 'dagpenge', ydelse: amount(1000) })
      );
      expect(state.periodComplete).toBe(true);
      expect(state.ydelsestypeSelected).toBe(true);
      expect(state.hasAnyAmount).toBe(true);
      expect(state.hasAnyFilled).toBe(true);
    });

    it('markerer en tom række som ufyldt', () => {
      const state = getOffentligeYdelserRowFilledState(makeRow({}));
      expect(state.hasAnyFilled).toBe(false);
      expect(state.periodComplete).toBe(false);
    });
  });

  describe('getOffentligeYdelserTableValidation', () => {
    it('giver ingen issues for en helt tom række', () => {
      const result = getOffentligeYdelserTableValidation({ rows: [makeRow({})] });
      expect(result.summary.rowIssues).toEqual([]);
      expect(result.summary.hasErrors).toBe(false);
      expect(result.summary.hasWarnings).toBe(false);
    });

    it('flagger en delvist udfyldt række som fejl (manglende påkrævede felter)', () => {
      const result = getOffentligeYdelserTableValidation({
        rows: [makeRow({ ydelse: amount(1000) })],
      });
      expect(result.summary.hasErrors).toBe(true);
      expect(result.summary.rowIssues).toContainEqual({ rowId: 'row-1', level: 'error', reason: 'missing' });
      // Første manglende felt i kolonne-rækkefølgen er fra-dato.
      expect(result.summary.firstErrorCell).toEqual({ rowId: 'row-1', colKey: 'fraDato', reason: 'missing' });
    });

    it('flagger en komplet periode+type uden beløb som advarsel', () => {
      const result = getOffentligeYdelserTableValidation({
        rows: [makeRow({ fraDato: iso('2024-01-01'), tilDato: iso('2024-01-31'), ydelsestype: 'dagpenge' })],
      });
      expect(result.summary.hasErrors).toBe(false);
      expect(result.summary.hasWarnings).toBe(true);
      expect(result.summary.rowIssues).toContainEqual({ rowId: 'row-1', level: 'warning', reason: 'missing' });
    });

    it('giver ingen issues for en fuldt udfyldt række', () => {
      const result = getOffentligeYdelserTableValidation({
        rows: [makeRow({ fraDato: iso('2024-01-01'), tilDato: iso('2024-01-31'), ydelsestype: 'dagpenge', ydelse: amount(1000) })],
      });
      expect(result.summary.rowIssues).toEqual([]);
      expect(result.summary.hasErrors).toBe(false);
      expect(result.summary.hasWarnings).toBe(false);
    });

    it('prioriterer input-cellefejl over manglende-felt og peger på første fejlcelle i kolonne-rækkefølge', () => {
      const result = getOffentligeYdelserTableValidation({
        rows: [makeRow({ fraDato: iso('2024-01-01'), tilDato: iso('2024-01-31'), ydelsestype: 'dagpenge', ydelse: amount(1000) })],
        cellErrorsByCellKey: { [buildOffentligeYdelserCellKey('row-1', 'ydelse')]: true },
      });
      expect(result.summary.hasErrors).toBe(true);
      expect(result.summary.rowIssues).toContainEqual({ rowId: 'row-1', level: 'error', reason: 'input' });
      expect(result.summary.firstErrorCell).toEqual({ rowId: 'row-1', colKey: 'ydelse', reason: 'input' });
    });
  });
});
