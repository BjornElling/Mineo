import { evaluateDownloadAllGate, evaluateOversigtDownloadGate } from '../../../domain/renteberegning/renteberegningDownloadGate';
import { toISODateString } from '../../../types/branded';

// Sandhedstabellen for de to renteberegning-download-gates skal være byte-for-byte
// identisk med de tidligere rå-booleans:
//   downloadAll(disabled) = !hasValidPdfContexts || anyRowHasError || beregningsdatoHasError   (+ loading separat i UI)
//   oversigt(disabled)    = beregningsdato === undefined || beregningsdatoHasError || !hasValidPdfContexts || anyRowHasError

const VALID_DATO = toISODateString('2024-12-31');

describe('renteberegningDownloadGate', () => {
  describe('evaluateDownloadAllGate', () => {
    it('tillader download når mindst én gyldig række og ingen fejl', () => {
      const gate = evaluateDownloadAllGate({ hasValidPdfContexts: true, anyRowHasError: false, beregningsdatoHasError: false });
      expect(gate.canDownload).toBe(true);
      expect(gate.reasons).toEqual([]);
    });

    it('blokerer når ingen gyldige rente-linjer', () => {
      const gate = evaluateDownloadAllGate({ hasValidPdfContexts: false, anyRowHasError: false, beregningsdatoHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:no-valid-rows');
    });

    it('blokerer når en række med indtastning er ugyldig', () => {
      const gate = evaluateDownloadAllGate({ hasValidPdfContexts: true, anyRowHasError: true, beregningsdatoHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:row-has-error');
    });

    it('blokerer når beregningsdato er ugyldig', () => {
      const gate = evaluateDownloadAllGate({ hasValidPdfContexts: true, anyRowHasError: false, beregningsdatoHasError: true });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:beregningsdato-error');
    });
  });

  describe('evaluateOversigtDownloadGate', () => {
    it('tillader download når dato udfyldt, gyldig række og ingen fejl', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: VALID_DATO, hasValidPdfContexts: true, anyRowHasError: false, beregningsdatoHasError: false });
      expect(gate.canDownload).toBe(true);
    });

    it('blokerer når beregningsdato mangler (undefined)', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: undefined, hasValidPdfContexts: true, anyRowHasError: false, beregningsdatoHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:missing-beregningsdato');
    });

    it('blokerer når beregningsdato er ugyldig', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: VALID_DATO, hasValidPdfContexts: true, anyRowHasError: false, beregningsdatoHasError: true });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:beregningsdato-error');
    });

    it('blokerer når ingen gyldige rente-linjer', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: VALID_DATO, hasValidPdfContexts: false, anyRowHasError: false, beregningsdatoHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:no-valid-rows');
    });

    it('blokerer når en række med indtastning er ugyldig', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: VALID_DATO, hasValidPdfContexts: true, anyRowHasError: true, beregningsdatoHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:row-has-error');
    });
  });

  // Ækvivalens-værn: gaten må aldrig afvige fra de tidligere rå-boolean-udtryk.
  // Loading-tilstanden er bevidst udeladt her (separat UI-transient).
  describe('ækvivalens med tidligere rå-booleans (fuld sandhedstabel)', () => {
    const bools = [false, true];
    for (const hasValidPdfContexts of bools) {
      for (const anyRowHasError of bools) {
        for (const beregningsdatoHasError of bools) {
          const input = { hasValidPdfContexts, anyRowHasError, beregningsdatoHasError };
          const expectedAllDisabled = !hasValidPdfContexts || anyRowHasError || beregningsdatoHasError;
          it(`downloadAll(${JSON.stringify(input)}) → disabled=${expectedAllDisabled}`, () => {
            expect(!evaluateDownloadAllGate(input).canDownload).toBe(expectedAllDisabled);
          });

          for (const datoUdfyldt of bools) {
            const beregningsdato = datoUdfyldt ? VALID_DATO : undefined;
            const expectedOversigtDisabled =
              beregningsdato === undefined || beregningsdatoHasError || !hasValidPdfContexts || anyRowHasError;
            it(`oversigt(${JSON.stringify({ ...input, datoUdfyldt })}) → disabled=${expectedOversigtDisabled}`, () => {
              expect(!evaluateOversigtDownloadGate({ ...input, beregningsdato }).canDownload).toBe(expectedOversigtDisabled);
            });
          }
        }
      }
    }
  });
});
