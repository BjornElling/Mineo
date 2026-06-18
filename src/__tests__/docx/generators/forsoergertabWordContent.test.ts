/// <reference types="vitest/globals" />
import { generateForsoergertabDocument } from '../../../document/generators/forsoergertab/forsoergertabDocument';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for forsørgertab: kører den RIGTIGE generator gennem
// Word-backenden med grundlæggende oplysninger (uden EAL/ASL-delberegninger)
// og verificerer, at titel og grundlæggende sektion faktisk når .docx'en.
describe('forsoergertab → Word-indhold', () => {
  it('skriver titel og grundlæggende oplysninger til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateForsoergertabDocument({
        grundlaeggende: {
          beregningsdato: toISODateString('2026-03-17'),
          skadelidteFodselsdato: toISODateString('1980-01-01'),
          efterladteFodselsdato: undefined,
          koen: undefined,
          visKoenValg: false,
          aslAarsloen: undefined,
          ealAarsloen: undefined,
          virkningsdato: undefined,
          tilkendtForPeriodeAar: undefined,
        },
        result: null,
        ealComputation: null,
        aslComputation: null,
        foersoergertabEalMinSats: null,
        foersoergertabForhoejtetTilMin: false,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Forsørgertab');
    expect(text).toContain('Grundlæggende oplysninger');
    expect(text).toContain('Beregningsdato');
  });
});
