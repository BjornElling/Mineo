/// <reference types="vitest/globals" />
import { generateEfterEalDocument } from '../../../document/generators/eet/eetEfterEalDocument';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for EET efter EAL: kører den RIGTIGE generator gennem
// Word-backenden med et komplet EetEalComputation-fixture og verificerer,
// at titel og beregningssektioner faktisk når .docx'en.
describe('efterEal → Word-indhold', () => {
  it('skriver titel og beregningssektioner til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateEfterEalDocument({
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2020-01-01'),
          fodselsdato: toISODateString('1980-01-01'),
          skadesaar: 2020,
          beregningsaar: 2026,
          aarsloen: 400000,
          aarsloenSource: 'eal',
          reguleringsaar: [2021, 2022, 2023, 2024, 2025, 2026],
          reguleringsPctRounded4: 12.5,
          reguleretAarsloen: 450000,
          eetPct: 50,
          eetPctSource: 'eal',
          kapitaliseringsfaktor: 10,
          eetBeregnet: 2250000,
          eetMaks: 9999999,
          eetAnvendt: 2250000,
          eetReduceretTilMaks: false,
          alderVedSkade: 40,
          alderVedSkadeCapped: 40,
          aldersreduktionPct: 5,
          aldersreduktionBeloeb: 112500,
          ealKrav: 2137500,
        } as never,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('EET efter EAL');
    expect(text).toContain('Erhvervsevnetab');
    expect(text).toContain('Beregnet EAL-krav');
  });
});
