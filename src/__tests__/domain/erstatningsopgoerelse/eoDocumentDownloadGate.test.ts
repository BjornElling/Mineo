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
