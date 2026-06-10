/// <reference types="vitest/globals" />
import { generateKapitaliseringPdf } from '../../../pdf/domains/kapitalisering/kapitaliseringPdf';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for kapitalisering (EET): kører den RIGTIGE generator gennem
// Word-backenden. Tom-afgørelse-stien er en gyldig dokumentsti (titel + empty
// state), og verificerer at empty-state-beskeden faktisk når .docx'en.
describe('kapitalisering → Word-indhold', () => {
  it('skriver titel og empty-state-besked når der ingen afgørelser er', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateKapitaliseringPdf({
        computation: { afgoerelser: [] } as never,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Kapitalisering (EET)');
    expect(text).toContain('Specifikation');
    expect(text).toContain('Der er ingen kapitaliserede afgørelser i sagen.');
  });
});
