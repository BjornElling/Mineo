// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateKapitaliseringDocument } from '../../../document/generators/kapitalisering/kapitaliseringDocument';
import type {
  EetKapitaliseringAfgoerelseComputation,
  EetKapitaliseringComputation,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for kapitalisering (EET): kører den RIGTIGE generator gennem
// Word-backenden. Tom-afgørelse-stien er en gyldig dokumentsti (titel + empty
// state); den udfyldte sti verificerer, at de tal-tunge mellemregninger og det
// beregnede kapitalbeløb faktisk når .docx'en.
describe('kapitalisering → Word-indhold', () => {
  it('skriver titel og empty-state-besked når der ingen afgørelser er', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateKapitaliseringDocument({
        computation: { afgoerelser: [] } satisfies EetKapitaliseringComputation,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Kapitalisering (EET)');
    expect(text).toContain('Specifikation');
    expect(text).toContain('Der er ingen kapitaliserede afgørelser i sagen.');
  });

  it('skriver mellemregning og beregnet kapitalbeløb på en udfyldt afgørelse', async () => {
    const afgoerelse = {
      rowId: 'kap-1',
      afgoerelsesdato: toISODateString('2025-01-01'),
      kapitaliseringsdato: toISODateString('2025-01-01'),
      kapitaliseringspct: 100,
      grundloen: 320000,
      erstatningsniveauPct: 80,
      amBidragPct: 8,
      grundydelse: 256000,
      grundydelse2024: null,
      opreguleringTil2024PctRounded4: null,
      aarsydelseGrundlag: 256000,
      aarsydelseReguleringsPctRounded4: null,
      aarsydelse: 256000,
      kapitaliseringsbekendtgoerelseLabel: 'Bekendtgørelse 2024',
      tabelLabel: 'Tabel A',
      folkepensionsalderLabel: '69 år',
      saerfaktor: null,
      alderAar: 45,
      alderMaaneder: 6,
      kapitaliseretPgaUnderToAarTilFp: false,
      faktorMaanedsAfhaengig: false,
      kapitaliseringsfaktor: 10,
      kapitalbelob: 2560000,
      koenOpdelt: false,
    } satisfies EetKapitaliseringAfgoerelseComputation;

    const { documentXml } = await renderWordDocument(() => {
      generateKapitaliseringDocument({
        computation: { afgoerelser: [afgoerelse] } satisfies EetKapitaliseringComputation,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Kapitalbeløb');
    // Mellemregningslinje (årsydelse x faktor) + det beregnede kapitalbeløb skal nå .docx'en.
    expect(text).toContain('256.000,00 kr. x 10');
    expect(text).toContain('2.560.000 kr.');
  });
});
