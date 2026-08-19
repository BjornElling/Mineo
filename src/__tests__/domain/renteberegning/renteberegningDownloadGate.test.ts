import { evaluateDownloadAllGate, evaluateOversigtDownloadGate } from '../../../domain/renteberegning/renteberegningDownloadGate';
import {
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
  resolveBlockedGateTooltip,
} from '../../../document/layout/documentGateTypes';
import { toISODateString } from '../../../types/branded';

// Sandhedstabellen dækker den canonical-afledte fallback for de to downloadgates. Afsluttet
// rejected input håndteres før disse funktioner af renteberegningens inputprojektion:
//   downloadAll(disabled) = !hasValidPdfContexts || anyRowHasError   (+ loading separat i UI)
//   oversigt(disabled)    = beregningsdato === undefined || !hasValidPdfContexts || anyRowHasError
//
// `anyRowHasError` svarede før «Fejl i indtastning». Det var forkert for HELE grenen: flaget aflæses kun i
// aggregatets `ready`-gren, og et rødt felt gør aggregatet `blocked` (rækkens felter læses med
// `collector.optional`). Er flaget sandt, er alle felter altså læsbare, og den manglende pdfContext skyldes
// en UFULDSTÆNDIG række – typisk et beløb uden «Renter fra»-dato. Klassen er derfor `missing-input`.
// `renteberegningProjectionMatrix.test.ts` dækker selve præmissen (rød række → blocked projektion).

const VALID_DATO = toISODateString('2024-12-31');

describe('renteberegningDownloadGate', () => {
  describe('evaluateDownloadAllGate', () => {
    it('tillader download når mindst én gyldig række og ingen fejl', () => {
      const gate = evaluateDownloadAllGate({ hasValidPdfContexts: true, anyRowHasError: false });
      expect(gate.canDownload).toBe(true);
      expect(gate.reasons).toEqual([]);
    });

    it('blokerer når ingen gyldige rente-linjer', () => {
      const gate = evaluateDownloadAllGate({ hasValidPdfContexts: false, anyRowHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:no-valid-rows');
    });

    it('blokerer når en række med indtastning er ufuldstændig', () => {
      const gate = evaluateDownloadAllGate({ hasValidPdfContexts: true, anyRowHasError: true });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:row-has-error');
      expect(gate.reasons[0]?.kind).toBe('missing-input');
      expect(resolveBlockedGateTooltip(gate.reasons)).toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    });

  });

  describe('evaluateOversigtDownloadGate', () => {
    it('tillader download når dato udfyldt, gyldig række og ingen fejl', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: VALID_DATO, hasValidPdfContexts: true, anyRowHasError: false });
      expect(gate.canDownload).toBe(true);
    });

    it('blokerer når beregningsdato mangler (undefined)', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: undefined, hasValidPdfContexts: true, anyRowHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:missing-beregningsdato');
    });

    it('blokerer når ingen gyldige rente-linjer', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: VALID_DATO, hasValidPdfContexts: false, anyRowHasError: false });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:no-valid-rows');
    });

    it('blokerer når en række med indtastning er ufuldstændig', () => {
      const gate = evaluateOversigtDownloadGate({ beregningsdato: VALID_DATO, hasValidPdfContexts: true, anyRowHasError: true });
      expect(gate.canDownload).toBe(false);
      expect(gate.reasons[0]?.code).toBe('renteberegning:row-has-error');
      expect(gate.reasons[0]?.kind).toBe('missing-input');
      expect(resolveBlockedGateTooltip(gate.reasons)).toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    });
  });

  // Ækvivalens-værn for canonical fallback. Loading-tilstanden og rejected input ligger
  // bevidst uden for disse rene funktioner.
  describe('canonical fallback (fuld sandhedstabel)', () => {
    const bools = [false, true];
    for (const hasValidPdfContexts of bools) {
      for (const anyRowHasError of bools) {
        const input = { hasValidPdfContexts, anyRowHasError };
        const expectedAllDisabled = !hasValidPdfContexts || anyRowHasError;
        it(`downloadAll(${JSON.stringify(input)}) → disabled=${expectedAllDisabled}`, () => {
          expect(!evaluateDownloadAllGate(input).canDownload).toBe(expectedAllDisabled);
        });

        for (const datoUdfyldt of bools) {
          const beregningsdato = datoUdfyldt ? VALID_DATO : undefined;
          const expectedOversigtDisabled =
            beregningsdato === undefined || !hasValidPdfContexts || anyRowHasError;
          it(`oversigt(${JSON.stringify({ ...input, datoUdfyldt })}) → disabled=${expectedOversigtDisabled}`, () => {
            expect(!evaluateOversigtDownloadGate({ ...input, beregningsdato }).canDownload).toBe(expectedOversigtDisabled);
          });
        }
      }
    }
  });
});
