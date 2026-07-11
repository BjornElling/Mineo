import {
  decideFieldResync,
  type FieldResyncFacts,
  type FieldResyncPolicy,
} from '../../../hooks/fieldState/fieldResyncMachine';

const FORM: FieldResyncPolicy = { pendingHoldOutranksEpoch: true };
const GRID: FieldResyncPolicy = { pendingHoldOutranksEpoch: false };

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
  describe('enig på tværs af begge surfaces', () => {
    it('idle, intet pending: resync til den eksterne kilde', () => {
      for (const policy of [FORM, GRID]) {
        expect(decideFieldResync(facts({}), policy)).toEqual({
          nextDraft: 'EXT',
          clearPending: false,
          commitEpoch: true,
          isAuthoritativeReplace: false,
        });
      }
    });

    it('aktiv redigering uden epoch: hold draften (ingen resync)', () => {
      for (const policy of [FORM, GRID]) {
        const cmd = decideFieldResync(facts({ isActivelyEditing: true }), policy);
        expect(cmd.nextDraft).toBeNull();
        expect(cmd.isAuthoritativeReplace).toBe(false);
      }
    });

    it('autoritativt replace vinder over aktiv redigering (resync uanset fokus)', () => {
      for (const policy of [FORM, GRID]) {
        const cmd = decideFieldResync(facts({ epochChanged: true, isActivelyEditing: true }), policy);
        expect(cmd.nextDraft).toBe('EXT');
        expect(cmd.isAuthoritativeReplace).toBe(true);
      }
    });

    it('pending-hold uden epoch (prop ikke indhentet): hold, ryd ikke pending', () => {
      // currentFormattedValue === pending.formattedValueAtCommit ⇒ proppen har endnu ikke indhentet.
      const f = facts({ currentFormattedValue: 'V', pending: { formattedValueAtCommit: 'V' } });
      for (const policy of [FORM, GRID]) {
        const cmd = decideFieldResync(f, policy);
        expect(cmd.nextDraft).toBeNull();
        expect(cmd.clearPending).toBe(false);
      }
    });

    it('pending men prop indhentet (fvac afviger): ryd pending og resync når idle', () => {
      const f = facts({ currentFormattedValue: 'NY', pending: { formattedValueAtCommit: 'GAMMEL' } });
      for (const policy of [FORM, GRID]) {
        expect(decideFieldResync(f, policy)).toEqual({
          nextDraft: 'EXT',
          clearPending: true,
          commitEpoch: true,
          isAuthoritativeReplace: false,
        });
      }
    });

    it('pending men prop indhentet + aktiv redigering: ryd pending, men hold draften', () => {
      const f = facts({
        currentFormattedValue: 'NY',
        pending: { formattedValueAtCommit: 'GAMMEL' },
        isActivelyEditing: true,
      });
      for (const policy of [FORM, GRID]) {
        const cmd = decideFieldResync(f, policy);
        expect(cmd.nextDraft).toBeNull();
        expect(cmd.clearPending).toBe(true);
      }
    });
  });

  describe('KLASSIFICERET divergens (bucket 3: uafklaret, bevaret verbatim)', () => {
    // Det ene punkt hvor surfaces reelt afviger: epoch-bump midt i et pending-hold
    // (autoritativt replace til præcis pre-commit-værdi, før proppen har sat sig).
    const f = facts({
      epochChanged: true,
      currentFormattedValue: 'V',
      pending: { formattedValueAtCommit: 'V' },
    });

    it('form: pending-hold er yderst → udskyd (hold, opdatér ikke epoch-ref)', () => {
      expect(decideFieldResync(f, FORM)).toEqual({
        nextDraft: null,
        clearPending: false,
        commitEpoch: false,
        isAuthoritativeReplace: false,
      });
    });

    it('grid: epoch er yderst → autoritativt replace vinder, resync straks', () => {
      expect(decideFieldResync(f, GRID)).toEqual({
        nextDraft: 'EXT',
        clearPending: true,
        commitEpoch: true,
        isAuthoritativeReplace: true,
      });
    });
  });
});
