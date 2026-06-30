import { evaluateVarigeMenDownloadGate } from '../../../domain/varigemen/varigeMenDownloadGate';

// Sandhedstabellen skal være byte-for-byte identisk med det tidligere inline-udtryk:
//   disabled = beregningsFejl || manglendeFelter || !beregningsResultat
// hvor de tre indgange er afledt af committed state.

describe('varigeMenDownloadGate', () => {
  it('tillader download når ingen fejl, ingen manglende felter og resultat findes', () => {
    const gate = evaluateVarigeMenDownloadGate({ hasBlockingFieldErrors: false, hasMissingFields: false, hasBeregningsResultat: true });
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it('blokerer ved blokerende feltfejl (højeste prioritet)', () => {
    const gate = evaluateVarigeMenDownloadGate({ hasBlockingFieldErrors: true, hasMissingFields: false, hasBeregningsResultat: true });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:field-error');
  });

  it('blokerer ved manglende felter', () => {
    const gate = evaluateVarigeMenDownloadGate({ hasBlockingFieldErrors: false, hasMissingFields: true, hasBeregningsResultat: false });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:missing-fields');
  });

  it('blokerer når beregning ikke kan dannes', () => {
    const gate = evaluateVarigeMenDownloadGate({ hasBlockingFieldErrors: false, hasMissingFields: false, hasBeregningsResultat: false });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:no-result');
  });

  // Ækvivalens-værn over hele sandhedstabellen.
  describe('ækvivalens med tidligere inline-boolean (fuld sandhedstabel)', () => {
    const bools = [false, true];
    for (const hasBlockingFieldErrors of bools) {
      for (const hasMissingFields of bools) {
        for (const hasBeregningsResultat of bools) {
          const input = { hasBlockingFieldErrors, hasMissingFields, hasBeregningsResultat };
          const expectedDisabled = hasBlockingFieldErrors || hasMissingFields || !hasBeregningsResultat;
          it(`(${JSON.stringify(input)}) → disabled=${expectedDisabled}`, () => {
            expect(!evaluateVarigeMenDownloadGate(input).canDownload).toBe(expectedDisabled);
          });
        }
      }
    }
  });
});
