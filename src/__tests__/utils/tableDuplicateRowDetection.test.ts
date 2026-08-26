import {
  findDuplicateRows,
  normalizeCellValueForDuplicateComparison,
} from '../../utils/tableDuplicateRowDetection';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

const amount = (value: number): AmountValue => ({ kind: 'number', value });
const expression = (expr: string, value: number): AmountValue => ({ kind: 'expression', expression: expr, value });

type Row = Readonly<{ id: string; fra?: string; til?: string; beloeb?: AmountValue }>;

const compare = (row: Row): readonly unknown[] => [row.fra, row.til, row.beloeb];

describe('tableDuplicateRowDetection', () => {
  describe('normalizeCellValueForDuplicateComparison', () => {
    it('reducerer et beløb til dets beregnede talværdi, så et udtryk og dets resultat er ens', () => {
      expect(normalizeCellValueForDuplicateComparison(expression('1000+1000', 2000)))
        .toBe(normalizeCellValueForDuplicateComparison(amount(2000)));
    });

    it('behandler alle tomme former som samme tomhed', () => {
      for (const empty of [undefined, null, '', '   ']) {
        expect(normalizeCellValueForDuplicateComparison(empty)).toBeNull();
      }
    });

    it('bevarer en eksplicit 0 som en værdi og ikke som tomhed', () => {
      expect(normalizeCellValueForDuplicateComparison(amount(0))).toBe(0);
      expect(normalizeCellValueForDuplicateComparison(0)).toBe(0);
    });

    it('trimmer strenge, så samme værdi med forskellig whitespace er ens', () => {
      expect(normalizeCellValueForDuplicateComparison('  01/2025 '))
        .toBe(normalizeCellValueForDuplicateComparison('01/2025'));
    });

    it('behandler et ikke-endeligt tal som tomt', () => {
      expect(normalizeCellValueForDuplicateComparison(Number.NaN)).toBeNull();
      expect(normalizeCellValueForDuplicateComparison(amount(Number.NaN))).toBeNull();
    });
  });

  describe('findDuplicateRows', () => {
    it('flager kun 2., 3., … forekomst – aldrig den første', () => {
      const rows: Row[] = [
        { id: 'a', fra: '1', til: '2025', beloeb: amount(30000) },
        { id: 'b', fra: '1', til: '2025', beloeb: amount(30000) },
        { id: 'c', fra: '1', til: '2025', beloeb: amount(30000) },
      ];

      const matches = findDuplicateRows(rows, compare);

      expect(matches.map((match) => match.row.id)).toEqual(['b', 'c']);
      expect(matches.every((match) => match.duplicateOf.id === 'a')).toBe(true);
    });

    it('regner et regneudtryk og dets resultat som den samme række', () => {
      const rows: Row[] = [
        { id: 'a', fra: '1', til: '2025', beloeb: amount(2000) },
        { id: 'b', fra: '1', til: '2025', beloeb: expression('1000+1000', 2000) },
      ];

      expect(findDuplicateRows(rows, compare).map((match) => match.row.id)).toEqual(['b']);
    });

    it('flager ikke rækker, der kun deler periode men har forskellige beløb', () => {
      const rows: Row[] = [
        { id: 'a', fra: '1', til: '2025', beloeb: amount(30000) },
        { id: 'b', fra: '1', til: '2025', beloeb: amount(20000) },
      ];

      expect(findDuplicateRows(rows, compare)).toEqual([]);
    });

    it('flager aldrig tomme rækker, uanset hvor mange der er', () => {
      const rows: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

      expect(findDuplicateRows(rows, compare)).toEqual([]);
    });

    it('flager to rækker med samme periode og 0 kr., fordi 0 er en bevidst indtastning', () => {
      const rows: Row[] = [
        { id: 'a', fra: '1', til: '2025', beloeb: amount(0) },
        { id: 'b', fra: '1', til: '2025', beloeb: amount(0) },
      ];

      expect(findDuplicateRows(rows, compare).map((match) => match.row.id)).toEqual(['b']);
    });

    it('sammenligner kun de felter, kalderen udpeger som relevante', () => {
      const rows: Row[] = [
        { id: 'a', fra: '1', til: '2025', beloeb: amount(30000) },
        { id: 'b', fra: '1', til: '2025', beloeb: amount(99999) },
      ];

      // Kun perioden sammenlignes: beløbsforskellen er da uden betydning.
      const matches = findDuplicateRows(rows, (row) => [row.fra, row.til]);

      expect(matches.map((match) => match.row.id)).toEqual(['b']);
    });
  });
});
