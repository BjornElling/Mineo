import { describe, expect, it } from 'vitest';
import { toReadableSummaryMessage } from '../../../domain/erstatningsopgoerelse/readableSummaryMessage';

describe('toReadableSummaryMessage', () => {
  it('normaliserer manuel regulering-besked med ny tekst', () => {
    expect(toReadableSummaryMessage('Værdier mangler at blive udfyldt for manuel regulering'))
      .toBe('Mangler udfyldte værdier for manuel regulering');
  });

  it('normaliserer manuel regulering-besked med gammel tekst (bagudkompatibilitet)', () => {
    expect(toReadableSummaryMessage('Mangler udfyldelse af værdier for Manuel Regulering'))
      .toBe('Mangler udfyldte værdier for manuel regulering');
  });

  it('er idempotent for "indeholder ugyldig indtastning"', () => {
    expect(toReadableSummaryMessage('indeholder ugyldig indtastning')).toBe('indeholder ugyldig indtastning');
  });

  it('normaliserer struktureret fejlwrapper', () => {
    expect(toReadableSummaryMessage('Fejl (Indtastning mangler)')).toBe('mangler');
  });
});
