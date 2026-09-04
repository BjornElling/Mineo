// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateDifferencekravDocument } from '../../../document/generators/differencekrav/differencekravDocument';
import type { EetDifferencekravComputation } from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';
import { fromKroner } from '../../../domain/money/money';

// Word-indholdstest for differencekrav: kører den RIGTIGE generator gennem
// Word-backenden med et realistisk computation-fixture (mineret fra
// differencekravPdf.test.ts) og verificerer, at titel og afgørelsesindhold
// faktisk når .docx'en.
describe('differencekrav → Word-indhold', () => {
  it('skriver titel og midlertidig-afgørelse-indhold til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateDifferencekravDocument(session, {
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2011-06-16'),
          dagFoerBeregningsdato: toISODateString('2026-03-16'),
          fradragGaelderForFoer2011: false,
          ealKravOre: fromKroner(100000),
          ealEetPct: 15,
          fradragLoebendeYdelserOre: fromKroner(0),
          fradragKapitaliseretEetOre: fromKroner(0),
          proformaKapitalisering: null,
          resterendeLoebendeYdelser: null,
          merErstatningPensionsalder: null,
          differencekravFoerForligOre: fromKroner(100000),
          forligFactor: null,
          forligLabel: null,
          forligDato: null,
          differencekravOre: fromKroner(100000),
          afgoerelser: [{
            rowId: 'afg-1',
            afgoerelsesdato: toISODateString('2020-01-01'),
            virkningsdato: toISODateString('2020-02-01'),
            afgoerelseType: 'Midlertidig',
            eetPct: 15,
            fradragesTil: toISODateString('2020-02-01'),
            beloebOre: fromKroner(0),
            fradragForetages: false,
            tilbagevirkendeKraftFradrag: null,
          }],
          kapitaliseringerAfgoerelser: [],
          loebendeComputation: null,
          kapComputation: null,
          ealComputation: null,
        } satisfies EetDifferencekravComputation,
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
    // Konkret beløb på en udfyldt sti: det beregnede differencekrav skal nå .docx'en.
    expect(text).toContain('100.000 kr.');
  });

  /**
   * BB-182: EAL-bilaget kaldes med `includeBeregningsdatoHeader = false`, som fjerner hele
   * «Beregning»-sektionen fra kroppen. Skadedatoen ligger derfor i Specifikationen og ikke i
   * headeren – ellers ville netop bilaget mangle den forudsætning, både opreguleringen og
   * aldersreduktionen hviler på, og differencekravets egen krop skriver den ikke.
   */
  it('bærer skadedatoen med i EAL-bilaget, hvor «Beregning»-sektionen er udeladt', async () => {
    const { documentXml } = await renderWordDocument((session) => {
      return generateDifferencekravDocument(session, {
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2018-06-01'),
          dagFoerBeregningsdato: toISODateString('2026-03-16'),
          fradragGaelderForFoer2011: false,
          ealKravOre: fromKroner(2137500),
          ealEetPct: 50,
          fradragLoebendeYdelserOre: fromKroner(0),
          fradragKapitaliseretEetOre: fromKroner(0),
          proformaKapitalisering: null,
          resterendeLoebendeYdelser: null,
          merErstatningPensionsalder: null,
          differencekravFoerForligOre: fromKroner(2137500),
          forligFactor: null,
          forligLabel: null,
          forligDato: null,
          differencekravOre: fromKroner(2137500),
          afgoerelser: [],
          kapitaliseringerAfgoerelser: [],
          loebendeComputation: null,
          kapComputation: null,
          ealComputation: {
            beregningsdato: toISODateString('2026-03-17'),
            skadedato: toISODateString('2018-06-01'),
            fodselsdato: toISODateString('1980-01-01'),
            skadesaar: 2018,
            beregningsaar: 2026,
            aarsloenOre: fromKroner(400000),
            aarsloenSource: 'asl',
            reguleringsaar: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
            reguleringsPctRounded4: 12.5,
            reguleretAarsloenOre: fromKroner(450000),
            eetPct: 50,
            eetPctSource: 'asl',
            kapitaliseringsfaktor: 10,
            eetBeregnetOre: fromKroner(2250000),
            eetMaksOre: fromKroner(9999999),
            eetAnvendtOre: fromKroner(2250000),
            eetReduceretTilMaks: false,
            alderVedSkade: 38,
            alderVedSkadeCapped: 38,
            aldersreduktionPct: 5,
            aldersreduktionBeloebOre: fromKroner(112500),
            ealKravOre: fromKroner(2137500),
          },
        } satisfies EetDifferencekravComputation,
        bilagSelection: {
          loebendeYdelser: false,
          kapitalisering: false,
          eetEfterEal: true,
          proformaKapitalisering: false,
          merErstatningPensionsalder: false,
          visUdvidetSpecifikationLoebendeYdelserBilag: false,
        },
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('EET efter EAL');
    // Bilaget har ingen «Beregning»-sektion – men skadedatoen er der.
    expect(text).toContain('Skadedato');
    expect(text).toContain('01-06-2018');
    // BB-177: adjektivet må ikke være tilbage i bilaget heller.
    expect(text).not.toContain('Endeligt erhvervsevnetab');
  });
});
