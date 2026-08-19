import {
  DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE,
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
  resolveBlockedGateTooltip,
} from '../../../document/layout/documentGateTypes';
import { evaluateEoDocumentDownloadGate } from '../../../domain/erstatningsopgoerelse/snapshot/eoDocumentDownloadGate';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';

const okSnapshot = (status: EoSnapshot['status'] = 'ok'): EoSnapshot =>
  ({ status, invariants: [] } as unknown as EoSnapshot);

const invariant = (message: string): EoInvariant =>
  ({ id: 'x', passed: false, severity: 'error', source: 'system', message, blocksAuthoritativeComputation: true } as EoInvariant);

const baseInput = {
  snapshot: okSnapshot(),
  projection: { kind: 'ok' } as const,
  authoritativeBlockingInvariants: [] as readonly EoInvariant[],
  blockingRowMessage: null as string | null,
  hasBlockingRows: false,
  failClosedFallback: 'fail-closed fallback',
  gateFallback: 'gate fallback',
};

describe('evaluateEoDocumentDownloadGate (A5: ét autoritativt output-gate pr. dokument)', () => {
  it('tillader download når projektionen er ok og ingen blokerende rækker', () => {
    const gate = evaluateEoDocumentDownloadGate(baseInput);
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it('blokerer på række-/EET-fejl med højeste præcedens (foran alt andet)', () => {
    const gate = evaluateEoDocumentDownloadGate({
      ...baseInput,
      hasBlockingRows: true,
      blockingRowMessage: 'Række-fejl',
      // selv med en blokeret projektion vinder række-beskeden
      projection: { kind: 'blocked', message: 'Projektion blokeret' },
    });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.message).toBe('Række-fejl');
  });

  it('blokerer når snapshot mangler', () => {
    const gate = evaluateEoDocumentDownloadGate({ ...baseInput, snapshot: null, projection: null });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.message).toBe('Download ikke mulig, før der er bygget et gyldigt snapshot');
  });

  it('bruger fail_closed-invariantbesked, ellers failClosedFallback', () => {
    const withMessage = evaluateEoDocumentDownloadGate({
      ...baseInput,
      snapshot: { status: 'fail_closed', invariants: [invariant('Fail-closed grund')] } as unknown as EoSnapshot,
      projection: { kind: 'blocked', message: 'irrelevant' },
    });
    expect(withMessage.reasons[0]?.message).toBe('Fail-closed grund');

    const withoutMessage = evaluateEoDocumentDownloadGate({
      ...baseInput,
      snapshot: { status: 'fail_closed', invariants: [] } as unknown as EoSnapshot,
      projection: { kind: 'blocked', message: 'irrelevant' },
    });
    expect(withoutMessage.reasons[0]?.message).toBe('fail-closed fallback');
  });

  it('bruger autoritativ-blokerende invariant før projektion', () => {
    const gate = evaluateEoDocumentDownloadGate({
      ...baseInput,
      authoritativeBlockingInvariants: [invariant('Autoritativ blokering')],
      projection: { kind: 'blocked', message: 'Projektion blokeret' },
    });
    expect(gate.reasons[0]?.message).toBe('Autoritativ blokering');
  });

  it('falder tilbage til projektion-beskeden når intet andet blokerer', () => {
    const gate = evaluateEoDocumentDownloadGate({
      ...baseInput,
      projection: { kind: 'blocked', message: 'Projektion blokeret' },
    });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.message).toBe('Projektion blokeret');
  });
});

/**
 * BRUGERTEKSTEN, ikke den interne `message`.
 *
 * Testene ovenfor hævder `reasons[0].message`, som bevidst er den INTERNE forklaring (koder, tests, logs).
 * Ingen af dem så, hvad brugeren faktisk læste – og netop derfor kunne EO's gate klassificere ALLE sine
 * blokeringer som `specific` (ordret citat), mens `EOberegningTab` i praksis overstyrede tooltippen med en
 * hardkodet streng. To kilder til samme afgørelse, ingen test imellem.
 */
describe('evaluateEoDocumentDownloadGate – brugerrettet tooltip', () => {
  it('henviser til fejlboksen ved en rækkeblokering frem for at citere rækken', () => {
    const gate = evaluateEoDocumentDownloadGate({
      ...baseInput,
      hasBlockingRows: true,
      blockingRowMessage: 'Feriegodtgørelse er ikke udfyldt',
    });
    expect(gate.reasons[0]?.kind).toBe('page-errors');
    expect(resolveBlockedGateTooltip(gate.reasons)).toBe(DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE);
    // Den konkrete besked bevares som intern forklaring, så koder/logs fortsat kan skelne.
    expect(gate.reasons[0]?.message).toBe('Feriegodtgørelse er ikke udfyldt');
  });

  /**
   * Fane-uafhængighed (`document-output-contract.md` §A2.1). Gaten har bevidst INGEN `isActive`-guard, mens
   * view-modellen filtrerer rækkerne væk på en inaktiv fane. Havde teksten hængt på view-modellens
   * filtrerede liste, kunne knappen henvise til fejl, der ikke var gengivet. Samme input ⇒ samme tekst.
   */
  it('giver samme tooltip uanset om fanen er aktiv (gaten kender ikke mount-tilstand)', () => {
    const gate = evaluateEoDocumentDownloadGate({
      ...baseInput,
      hasBlockingRows: true,
      blockingRowMessage: 'Feriegodtgørelse er ikke udfyldt',
    });
    const again = evaluateEoDocumentDownloadGate({
      ...baseInput,
      hasBlockingRows: true,
      blockingRowMessage: 'Feriegodtgørelse er ikke udfyldt',
    });
    expect(resolveBlockedGateTooltip(gate.reasons)).toBe(resolveBlockedGateTooltip(again.reasons));
  });

  /**
   * Snapshot-, invariant- og projektionsblokeringer er IKKE rækkefejl: de har ingen garanteret række i
   * boksen (sikkerhedsnettet i `useEoBeregningViewModel` findes netop for at fange dem). At henvise til
   * "fejl ovenfor" ville pege på en boks, der kan være tom.
   */
  it.each([
    ['manglende snapshot', { snapshot: null, projection: null }],
    ['fail_closed', { snapshot: { status: 'fail_closed', invariants: [invariant('F')] } as unknown as EoSnapshot, projection: { kind: 'blocked' as const, message: 'x' } }],
    ['autoritativ invariant', { authoritativeBlockingInvariants: [invariant('A')], projection: { kind: 'blocked' as const, message: 'x' } }],
    ['blokeret projektion', { projection: { kind: 'blocked' as const, message: 'Projektion blokeret' } }],
  ])('bruger IKKE page-errors ved %s', (_label, overrides) => {
    const gate = evaluateEoDocumentDownloadGate({ ...baseInput, ...overrides });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.kind).not.toBe('page-errors');
    expect(resolveBlockedGateTooltip(gate.reasons)).toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
  });
});
