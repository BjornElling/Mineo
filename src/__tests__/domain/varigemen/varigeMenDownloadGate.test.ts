import { evaluateVarigeMenDownloadGate } from '../../../domain/varigemen/varigeMenDownloadGate';
import { toISODateString } from '../../../types/branded';

// Sandhedstabellen skal være byte-for-byte identisk med det tidligere inline-udtryk:
//   disabled = beregningsFejl || manglendeFelter || !beregningsResultat
// hvor de tre indgange er afledt af committed state.

describe('varigeMenDownloadGate', () => {
  const validStamdata = {
    skadelidteFodselsdato: toISODateString('1980-01-01'),
    skadedato: toISODateString('2020-01-01'),
  };

  it('tillader download når ingen fejl, ingen manglende felter og resultat findes', () => {
    const gate = evaluateVarigeMenDownloadGate({ stamdata: validStamdata, hasBlockingFieldErrors: false, hasMissingFields: false, hasBeregningsResultat: true });
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it('blokerer ved blokerende feltfejl (højeste prioritet)', () => {
    const gate = evaluateVarigeMenDownloadGate({ stamdata: validStamdata, hasBlockingFieldErrors: true, hasMissingFields: false, hasBeregningsResultat: true });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:field-error');
  });

  it('blokerer ved manglende felter', () => {
    const gate = evaluateVarigeMenDownloadGate({ stamdata: validStamdata, hasBlockingFieldErrors: false, hasMissingFields: true, hasBeregningsResultat: false });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:missing-fields');
  });

  it('blokerer når beregning ikke kan dannes', () => {
    const gate = evaluateVarigeMenDownloadGate({ stamdata: validStamdata, hasBlockingFieldErrors: false, hasMissingFields: false, hasBeregningsResultat: false });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:no-result');
  });

  it('blokerer ved skadedato før fødselsdato uden monteret stamdata-side', () => {
    const gate = evaluateVarigeMenDownloadGate({
      stamdata: {
        skadelidteFodselsdato: toISODateString('2025-01-01'),
        skadedato: toISODateString('2024-01-01'),
      },
      hasBlockingFieldErrors: false,
      hasMissingFields: false,
      hasBeregningsResultat: true,
    });
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:stamdata-date-order');
  });

  // Ækvivalens-værn over hele sandhedstabellen.
  describe('ækvivalens med tidligere inline-boolean (fuld sandhedstabel)', () => {
    const bools = [false, true];
    for (const hasBlockingFieldErrors of bools) {
      for (const hasMissingFields of bools) {
        for (const hasBeregningsResultat of bools) {
          const input = { stamdata: validStamdata, hasBlockingFieldErrors, hasMissingFields, hasBeregningsResultat };
          const expectedDisabled = hasBlockingFieldErrors || hasMissingFields || !hasBeregningsResultat;
          it(`(${JSON.stringify(input)}) → disabled=${expectedDisabled}`, () => {
            expect(!evaluateVarigeMenDownloadGate(input).canDownload).toBe(expectedDisabled);
          });
        }
      }
    }
  });
});
