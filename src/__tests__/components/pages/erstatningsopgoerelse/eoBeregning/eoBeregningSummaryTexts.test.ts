import {
  resolveKravIkkeRejstTekst,
  resolveOevrigeKravSummaryText,
} from '../../../../../components/pages/erstatningsopgoerelse/eoBeregning/eoBeregningSummaryTexts';

describe('eoBeregningSummaryTexts', () => {
  it('skriver samme ord for et fravalgt krav, uanset hvilket af de tre krav det er (BB-227, BB-234)', () => {
    expect(resolveKravIkkeRejstTekst('Nej')).toBe('Ikke rejst');
    expect(resolveKravIkkeRejstTekst('Skjul')).toBe('Ikke rejst (skjult)');
    expect(resolveKravIkkeRejstTekst('Ja')).toBeUndefined();
  });

  it.each([
    [{ kravvalg: 'Skjul', harFejl: false, antalPoster: 2 }, 'Ikke rejst (skjult)'],
    [{ kravvalg: 'Nej', harFejl: true, antalPoster: 2 }, 'Ikke rejst'],
    [{ kravvalg: 'Ja', harFejl: true, antalPoster: 2 }, 'Fejl'],
    [{ kravvalg: 'Ja', harFejl: false, antalPoster: 0 }, 'Ingen poster angivet'],
    [{ kravvalg: 'Ja', harFejl: false, antalPoster: 1 }, '1 post'],
    [{ kravvalg: 'Ja', harFejl: false, antalPoster: 2 }, '2 poster'],
  ] as const)('øvrige krav %o → «%s» (BB-234)', (args, forventet) => {
    expect(resolveOevrigeKravSummaryText(args)).toBe(forventet);
  });
});
