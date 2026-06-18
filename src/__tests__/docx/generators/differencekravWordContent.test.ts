/// <reference types="vitest/globals" />
import { generateDifferencekravDocument } from '../../../document/generators/differencekrav/differencekravDocument';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for differencekrav: kører den RIGTIGE generator gennem
// Word-backenden med et realistisk computation-fixture (mineret fra
// differencekravPdf.test.ts) og verificerer, at titel og afgørelsesindhold
// faktisk når .docx'en.
describe('differencekrav → Word-indhold', () => {
  it('skriver titel og midlertidig-afgørelse-indhold til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateDifferencekravDocument({
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2011-06-16'),
          dagFoerBeregningsdato: toISODateString('2026-03-16'),
          ealKrav: 100000,
          ealEetPct: 15,
          fradragLoebendeYdelser: 0,
          fradragKapitaliseretEet: 0,
          proformaKapitalisering: null,
          proformaBeloeb: 0,
          differencekravFoerForlig: 100000,
          forligFactor: null,
          forligLabel: null,
          differencekrav: 100000,
          afgoerelser: [{
            afgoerelsesdato: toISODateString('2020-01-01'),
            virkningsdato: toISODateString('2020-02-01'),
            afgoerelseType: 'Midlertidig',
            eetPct: 15,
            beloeb: 0,
            fradragForetages: false,
            fradragesTil: null,
          }],
          kapitaliseringerAfgoerelser: [],
          loebendeComputation: null,
          kapComputation: null,
          ealComputation: null,
        } as never,
        bilagSelection: {
          loebendeYdelser: false,
          kapitalisering: false,
          eetEfterEal: false,
          proformaKapitalisering: false,
          merErstatningPensionsalder: false,
          visUdvidetSpecifikationLoebendeYdelserBilag: false,
        },
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Differencekrav (EET)');
    expect(text).toContain('Midlertidig afgørelse');
    expect(text).toContain('Skaden er indtrådt den 16. juni 2011 eller senere.');
  });
});
