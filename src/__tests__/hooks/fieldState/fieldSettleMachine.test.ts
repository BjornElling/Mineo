import {
  decideFieldSettle,
  type FieldSettleFacts,
} from '../../../hooks/fieldState/fieldSettleMachine';

const facts = <TValue>(overrides: Partial<FieldSettleFacts<TValue>> & Pick<FieldSettleFacts<TValue>, 'parse'>): FieldSettleFacts<TValue> => ({
  isNoop: false,
  formattedValueAtCommit: 'CUR',
  target: 'TARGET',
  ...overrides,
});

/**
 * Adfærdsmatrix for den delte settle-invariant. De tre parse-udfald (valid/invalid/inert) og de to
 * commit-underforgreninger (no-op vs reel ændring, pending-guard) er de fælles beslutninger, som
 * `useDraftField.commitFromDraft` og `useTableInputCore.commitAndEmitBlur` tidligere duplikerede.
 */
describe('decideFieldSettle — delt settle-invariant', () => {
  describe('ugyldig råstreng (fejlsemantik)', () => {
    it('bevarer råstrengen og markerer den til ugyldig-draft-slotten', () => {
      const cmd = decideFieldSettle('12..20', facts<string>({ parse: { status: 'invalid' } }));
      expect(cmd).toEqual({ kind: 'invalid', raw: '12..20' });
    });

    it('bruger den præcise råstreng, ikke target/committed', () => {
      const cmd = decideFieldSettle('  rå  ', facts<number>({
        parse: { status: 'invalid' },
        formattedValueAtCommit: 'FVAC',
        target: 'IGNORERET',
      }));
      expect(cmd).toEqual({ kind: 'invalid', raw: '  rå  ' });
    });
  });

  describe('inert (tom/partial uden besked)', () => {
    it('committer intet og skriver ingen rejection', () => {
      const cmd = decideFieldSettle('', facts<string>({ parse: { status: 'inert' } }));
      expect(cmd).toEqual({ kind: 'inert' });
    });
  });

  describe('gyldig værdi', () => {
    it('reel ændring (target afviger fra committed): commit med pending-guard', () => {
      const cmd = decideFieldSettle('42', facts<number>({
        parse: { status: 'valid', value: 42 },
        formattedValueAtCommit: 'GAMMEL',
        target: 'NY',
      }));
      expect(cmd).toEqual({
        kind: 'commit',
        value: 42,
        target: 'NY',
        noop: false,
        pending: { formattedValueAtCommit: 'GAMMEL' },
      });
    });

    it('target === committed visning: commit UDEN pending-guard (ingen flicker-risiko)', () => {
      const cmd = decideFieldSettle('42', facts<number>({
        parse: { status: 'valid', value: 42 },
        formattedValueAtCommit: 'SAMME',
        target: 'SAMME',
      }));
      expect(cmd).toEqual({
        kind: 'commit',
        value: 42,
        target: 'SAMME',
        noop: false,
        pending: null,
      });
    });

    it('no-op-commit (uændret canonical værdi) bæres videre til kalderen', () => {
      const cmd = decideFieldSettle('42', facts<number>({
        parse: { status: 'valid', value: 42 },
        isNoop: true,
        formattedValueAtCommit: 'SAMME',
        target: 'SAMME',
      }));
      expect(cmd).toEqual({
        kind: 'commit',
        value: 42,
        target: 'SAMME',
        noop: true,
        pending: null,
      });
    });

    it('no-op kan stadig have divergerende visning → pending-guarden sættes uafhængigt af no-op', () => {
      // Pending-guarden afhænger KUN af target vs formattedValueAtCommit, ikke af no-op-flaget.
      const cmd = decideFieldSettle('42', facts<number>({
        parse: { status: 'valid', value: 42 },
        isNoop: true,
        formattedValueAtCommit: 'GAMMEL',
        target: 'NY',
      }));
      expect(cmd.kind).toBe('commit');
      if (cmd.kind !== 'commit') throw new Error('forventede commit');
      expect(cmd.noop).toBe(true);
      expect(cmd.pending).toEqual({ formattedValueAtCommit: 'GAMMEL' });
    });

    it('bevarer den canonical værditype (ikke kun strenge)', () => {
      const value = { iso: '2024-01-01' } as const;
      const cmd = decideFieldSettle('01-01-2024', facts<typeof value>({
        parse: { status: 'valid', value },
        target: '01-01-2024',
        formattedValueAtCommit: '',
      }));
      expect(cmd.kind).toBe('commit');
      if (cmd.kind !== 'commit') throw new Error('forventede commit');
      expect(cmd.value).toBe(value);
    });
  });
});
