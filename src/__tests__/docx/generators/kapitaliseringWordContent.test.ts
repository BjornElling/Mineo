// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateKapitaliseringDocument } from '../../../document/generators/kapitalisering/kapitaliseringDocument';
import type {
  EetKapitaliseringAfgoerelseComputation,
  EetKapitaliseringComputation,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { toISODateString } from '../../../types/branded';
import { fromKroner } from '../../../domain/money/money';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for kapitalisering (EET): kører den RIGTIGE generator gennem
// Word-backenden. Tom-afgørelse-stien er en gyldig dokumentsti (titel + empty
// state); den udfyldte sti verificerer, at de tal-tunge mellemregninger og det
// beregnede kapitalbeløb faktisk når .docx'en.
describe('kapitalisering → Word-indhold', () => {
  it('skriver titel og empty-state-besked når der ingen afgørelser er', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateKapitaliseringDocument(session, {
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
      // Afgørelsens EGEN erhvervsevnetabsprocent er 30, mens kapitaliseringsprocenten nedenfor er
      // 100. De to er forskellige størrelser, og det er netop pointen i BB-170: overskriften skal
      // bære afgørelsens procent, så læseren kan se hvor stor en del kapitalbeløbet dækker.
      eetPct: 30,
      kapitaliseringspct: 100,
      grundloenOre: fromKroner(320000),
      erstatningsniveauPct: 80,
      amBidragPct: 8,
      grundydelseOre: fromKroner(256000),
      grundydelse2024Ore: null,
      opreguleringTil2024PctRounded4: null,
      aarsydelseGrundlagOre: fromKroner(256000),
      aarsydelseReguleringsPctRounded4: null,
      aarsydelseOre: fromKroner(256000),
      kapitaliseringsbekendtgoerelseLabel: 'Bekendtgørelse 2024',
      tabelLabel: 'Tabel A',
      folkepensionsalderLabel: '69 år',
      saerfaktor: null,
      alderAar: 45,
      alderMaaneder: 6,
      kapitaliseretPgaUnderToAarTilFp: false,
      faktorMaanedsAfhaengig: false,
      kapitaliseringsfaktor: 10,
      kapitalbelobOre: fromKroner(2560000),
      koenOpdelt: false,
    } satisfies EetKapitaliseringAfgoerelseComputation;

    const { documentXml } = await renderWordDocument((session) => {
      return generateKapitaliseringDocument(session, {
        computation: { afgoerelser: [afgoerelse] } satisfies EetKapitaliseringComputation,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Kapitalbeløb');
    // Mellemregningslinje (årsydelse x faktor) + det beregnede kapitalbeløb skal nå .docx'en.
    expect(text).toContain('256.000,00 kr. x 10');
    expect(text).toContain('2.560.000 kr.');
    // BB-170/BB-171: overskriften bærer afgørelsens egen EET-procent – både så læseren kan se hvor
    // stor en del af tabet kapitalbeløbet dækker, og så to afgørelser fra samme dag kan skilles i
    // et dokument, hvor de to sider ikke kan ses samtidig.
    expect(text).toContain('Afgørelse 1. januar 2025 (30 %)');
    // BB-175: rækken hedder «Kapitaliseringsprocent», som feltets egne fejlbeskeder – ikke
    // «Kapitalisering», der navngiver hele handlingen.
    expect(text).toContain('Kapitaliseringsprocent');
    // BB-167: beregningsdatoen står ikke i dokumentet, og skal heller ikke stå på skærmen.
    expect(text).not.toContain('Beregningsdato');
  });
});
