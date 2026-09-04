// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateEfterEalDocument } from '../../../document/generators/eet/eetEfterEalDocument';
import type { EetEalComputation } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';
import { fromKroner } from '../../../domain/money/money';

// Word-indholdstest for EET efter EAL: kører den RIGTIGE generator gennem
// Word-backenden med et komplet EetEalComputation-fixture og verificerer,
// at titel og beregningssektioner faktisk når .docx'en.
describe('efterEal → Word-indhold', () => {
  it('skriver titel og beregningssektioner til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateEfterEalDocument(session, {
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2020-01-01'),
          fodselsdato: toISODateString('1980-01-01'),
          skadesaar: 2020,
          beregningsaar: 2026,
          aarsloenOre: fromKroner(400000),
          aarsloenSource: 'eal',
          reguleringsaar: [2021, 2022, 2023, 2024, 2025, 2026],
          reguleringsPctRounded4: 12.5,
          reguleretAarsloenOre: fromKroner(450000),
          eetPct: 50,
          eetPctSource: 'eal',
          kapitaliseringsfaktor: 10,
          eetBeregnetOre: fromKroner(2250000),
          eetMaksOre: fromKroner(9999999),
          eetAnvendtOre: fromKroner(2250000),
          eetReduceretTilMaks: false,
          alderVedSkade: 40,
          alderVedSkadeCapped: 40,
          aldersreduktionPct: 5,
          aldersreduktionBeloebOre: fromKroner(112500),
          ealKravOre: fromKroner(2137500),
        } satisfies EetEalComputation,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('EET efter EAL');
    expect(text).toContain('Erhvervsevnetab');
    expect(text).toContain('Beregnet EAL-krav');
    // Konkrete beløb på en udfyldt sti: den opregulerede årsløn, mellemregningen
    // (reguleret årsløn x 10 x EET-pct.) og det beregnede erhvervsevnetab skal nå .docx'en.
    // Fanger skjult tab af tal-tunge linjer i Word (ikke bare overskrifter/labels).
    expect(text).toContain('450.000 kr.'); // reguleretAarsloen
    expect(text).toContain('450.000 kr. x 10 x'); // mellemregningslinje
    expect(text).toContain('2.250.000 kr.'); // eetBeregnet
    expect(text).toContain('2.137.500 kr.'); // ealKrav (slutbeløb)

    // BB-182: skadedatoen bærer både aldersreduktionen og opreguleringen, men stod ikke i dokumentet
    // – kun fødselsdatoen plus en færdig alder, hvoraf modparten højst kan indsnævre datoen til et år.
    expect(text).toContain('Skadedato');
    expect(text).toContain('01-01-2020');

    // BB-177: rækken hed «Endeligt erhvervsevnetab» over en procent, der kan komme fra en afgørelse,
    // brugeren har markeret Midlertidig. EAL kender ikke et midlertidigt erhvervsevnetab, så
    // adjektivet var en påstand om sagen uden dækning.
    expect(text).not.toContain('Endeligt erhvervsevnetab');
  });

});
