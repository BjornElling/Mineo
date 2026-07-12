import {
  decideFieldResync,
  type FieldResyncFacts,
} from '../../../hooks/fieldState/fieldResyncMachine';

const facts = (overrides: Partial<FieldResyncFacts>): FieldResyncFacts => ({
  epochChanged: false,
  externalSource: 'EXT',
  currentFormattedValue: 'CUR',
  pending: null,
  isActivelyEditing: false,
  ...overrides,
});

/**
 * Adfærdsmatrix for den delte resync-invariant. Kolonnerne pending/epoch/editing er de fælles edge
 * cases brugeren udpegede; de to policy-rækker (form vs grid) er de to surfaces. Testen dokumenterer
 * hvor de er ENIGE (langt de fleste celler) og pinner den ENE klassificerede divergens eksplicit.
 */
describe('decideFieldResync — delt resync-invariant', () => {
  describe('fælles for form og grid', () => {
    it('idle, intet pending: resync til den eksterne kilde', () => {
      expect(decideFieldResync(facts({}))).toEqual({
        nextDraft: 'EXT',
        clearPending: false,
        commitEpoch: true,
        isAuthoritativeReplace: false,
      });
    });

    it('aktiv redigering uden epoch: hold draften (ingen resync)', () => {
      const cmd = decideFieldResync(facts({ isActivelyEditing: true }));
      expect(cmd.nextDraft).toBeNull();
      expect(cmd.isAuthoritativeReplace).toBe(false);
    });

    it('autoritativt replace vinder over aktiv redigering (resync uanset fokus)', () => {
      const cmd = decideFieldResync(facts({ epochChanged: true, isActivelyEditing: true }));
      expect(cmd.nextDraft).toBe('EXT');
      expect(cmd.isAuthoritativeReplace).toBe(true);
    });

    it('pending-hold uden epoch (prop ikke indhentet): hold, ryd ikke pending', () => {
      // currentFormattedValue === pending.formattedValueAtCommit ⇒ proppen har endnu ikke indhentet.
      const f = facts({ currentFormattedValue: 'V', pending: { formattedValueAtCommit: 'V' } });
      const cmd = decideFieldResync(f);
      expect(cmd.nextDraft).toBeNull();
      expect(cmd.clearPending).toBe(false);
    });

    it('pending men prop indhentet (fvac afviger): ryd pending og resync når idle', () => {
      const f = facts({ currentFormattedValue: 'NY', pending: { formattedValueAtCommit: 'GAMMEL' } });
      expect(decideFieldResync(f)).toEqual({
        nextDraft: 'EXT',
        clearPending: true,
        commitEpoch: true,
        isAuthoritativeReplace: false,
      });
    });

    it('pending men prop indhentet + aktiv redigering: ryd pending, men hold draften', () => {
      const f = facts({
        currentFormattedValue: 'NY',
        pending: { formattedValueAtCommit: 'GAMMEL' },
        isActivelyEditing: true,
      });
      const cmd = decideFieldResync(f);
      expect(cmd.nextDraft).toBeNull();
      expect(cmd.clearPending).toBe(true);
    });
  });

  describe('autoritativt replace under pending-hold', () => {
    const f = facts({
      epochChanged: true,
      currentFormattedValue: 'V',
      pending: { formattedValueAtCommit: 'V' },
    });

    it('epoch vinder fælles for form og grid', () => {
      expect(decideFieldResync(f)).toEqual({
        nextDraft: 'EXT',
        clearPending: true,
        commitEpoch: true,
        isAuthoritativeReplace: true,
      });
    });
  });
});
