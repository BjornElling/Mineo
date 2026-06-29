// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateVarigeMenDocument } from '../../../document/generators/varigemen/varigeMenDocument';
import { beregnVarigeMenGodtgoerelseWithRates } from '../../../domain/varigemen/varigeMenCalculations';
import { varigeMenPrGrad } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for ménberegning: kører den RIGTIGE generator gennem
// Word-backenden med et RIGTIGT VarigeMenBeregningResult og verificerer, at
// titel og sektionsoverskrifter/etiketter faktisk når .docx'en.
describe('varigeMen → Word-indhold', () => {
  // Realistisk input: 65-årig på skadestidspunkt → aldersreduktion udløses.
  const fodselsdato = toISODateString('1959-03-01');
  const skadedato = toISODateString('2024-04-01');
  const beregningsdato = toISODateString('2024-06-01');
  const mengrad = 15;

  const beregningsResultat = beregnVarigeMenGodtgoerelseWithRates(
    { mengrad, beregningsdato },
    skadedato,
    varigeMenPrGrad,
    fodselsdato
  );

  it('skriver titel og alle sektionsoverskrifter til .docx', async () => {
    expect(beregningsResultat).not.toBeNull();

    const { filename, documentXml } = await renderWordDocument(() => {
      generateVarigeMenDocument({
        fodselsdato,
        skadedato,
        mengrad,
        beregningsdato,
        beregningsResultat: beregningsResultat!,
        skadedatoLabel: 'Skadedato',
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Ménberegning');
    expect(text).toContain('Stamdata');
    expect(text).toContain('Beregningsgrundlag');
    expect(text).toContain('Beregnet méngodtgørelse');
    // Aldersreduktion-linjen skal være med (alder > 39 → reduktion).
    expect(text).toMatch(/Aldersreduktion/);
  });

  it('inkluderer brevhoved-journalnr når brevhoved er slået til', async () => {
    expect(beregningsResultat).not.toBeNull();

    const { documentXml } = await renderWordDocument(() => {
      generateVarigeMenDocument({
        fodselsdato,
        skadedato,
        mengrad,
        beregningsdato,
        beregningsResultat: beregningsResultat!,
        skadedatoLabel: 'Skadedato',
        visBrevhoved: true,
        stamdata: { journalnr: '4711', advokat: 'AB', sagsbehandler: 'CD' } as never,
      });
    });

    expect(xmlToPlainText(documentXml)).toContain('4711');
  });
});
