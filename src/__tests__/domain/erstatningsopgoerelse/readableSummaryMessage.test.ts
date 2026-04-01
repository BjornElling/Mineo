import { toReadableSummaryMessage } from '../../../domain/erstatningsopgoerelse/pdf/readableSummaryMessage';

describe('toReadableSummaryMessage', () => {
  // ─── Tomme strenge ───────────────────────────────────────────────────────────

  it('returnerer tom streng for tom input', () => {
    expect(toReadableSummaryMessage('')).toBe('');
  });

  it('returnerer tom streng for whitespace-only input', () => {
    expect(toReadableSummaryMessage('   ')).toBe('');
  });

  // ─── Kendte enkelt-beskeder ──────────────────────────────────────────────────

  it('normaliserer "Indtastning mangler" → "mangler"', () => {
    expect(toReadableSummaryMessage('Indtastning mangler')).toBe('mangler');
  });

  it('normaliserer "Alle lønoplysninger..." → "Lønoplysninger mangler"', () => {
    expect(toReadableSummaryMessage('Alle lønoplysninger indtastet korrekt mangler'))
      .toBe('Lønoplysninger mangler');
  });

  it('normaliserer "Ugyldig indtastning" → "indeholder ugyldig indtastning"', () => {
    expect(toReadableSummaryMessage('Ugyldig indtastning')).toBe('indeholder ugyldig indtastning');
  });

  it('normaliserer manuel regulering-besked', () => {
    expect(toReadableSummaryMessage('Værdier mangler at blive udfyldt for manuel regulering'))
      .toBe('Mangler udfyldte værdier for manuel regulering');
  });

  // ─── "X er ikke valgt"-mønster ───────────────────────────────────────────────

  it('normaliserer "X er ikke valgt" → "X mangler"', () => {
    expect(toReadableSummaryMessage('Beregningsgrundlag er ikke valgt'))
      .toBe('Beregningsgrundlag mangler');
  });

  it('bevarer case for "er ikke valgt"-match', () => {
    expect(toReadableSummaryMessage('ATP-sats er ikke valgt'))
      .toBe('ATP-sats mangler');
  });

  // ─── "X mangler"-mønster (feltspecifikt) ─────────────────────────────────────

  it('normaliserer feltspecifik "X mangler" → "X mangler"', () => {
    expect(toReadableSummaryMessage('Feriedagpengeperiode mangler'))
      .toBe('Feriedagpengeperiode mangler');
  });

  it('normaliserer ikke "Indtastning mangler" via felt-mønster (fanges af tidlig guard)', () => {
    // 'Indtastning mangler' fanges som kanonisk besked → 'mangler' (ikke '"indtastning" mangler')
    expect(toReadableSummaryMessage('Indtastning mangler')).toBe('mangler');
  });

  // ─── Fejl/Advarsel-wrapper ───────────────────────────────────────────────────

  it('unwrapper "Fejl (X)" og anvender intern normalisering', () => {
    expect(toReadableSummaryMessage('Fejl (Indtastning mangler)')).toBe('mangler');
  });

  it('unwrapper "Advarsel (X)" og anvender intern normalisering', () => {
    expect(toReadableSummaryMessage('Advarsel (Ugyldig indtastning)'))
      .toBe('indeholder ugyldig indtastning');
  });

  it('unwrapper "Fejl (X)" med felt-mønster', () => {
    expect(toReadableSummaryMessage('Fejl (Startdato er ikke valgt)'))
      .toBe('Startdato mangler');
  });

  // ─── Pass-through ─────────────────────────────────────────────────────────────

  it('er idempotent for "indeholder ugyldig indtastning"', () => {
    expect(toReadableSummaryMessage('indeholder ugyldig indtastning')).toBe('indeholder ugyldig indtastning');
  });

  it('returnerer ukendte beskeder urørt', () => {
    expect(toReadableSummaryMessage('En helt anden besked')).toBe('En helt anden besked');
  });
});
