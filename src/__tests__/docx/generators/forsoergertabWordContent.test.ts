// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateForsoergertabDocument } from '../../../document/generators/forsoergertab/forsoergertabDocument';
import { computeForsoergertabCalculation } from '../../../domain/forsoergertab/forsoergertabCalculation';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { formatKr } from '../../../utils/formatUtils';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

// Word-indholdstest for forsørgertab: kører den RIGTIGE generator gennem
// Word-backenden med grundlæggende oplysninger (uden EAL/ASL-delberegninger)
// og verificerer, at titel og grundlæggende sektion faktisk når .docx'en.
describe('forsoergertab → Word-indhold', () => {
  it('skriver titel og grundlæggende oplysninger til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateForsoergertabDocument(session, {
        grundlaeggende: {
          beregningsdato: toISODateString('2026-03-17'),
          skadelidteFodselsdato: toISODateString('1980-01-01'),
          skadedato: toISODateString('2020-05-01'),
          skadestype: 'Arbejdsulykke' as const,
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
        foersoergertabEalMinSatsOre: null,
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

  it('skriver beregnede beløb og EAL-mellemregning på en fuldt udfyldt sti', async () => {
    // Fixturen bygges fra den RIGTIGE domæneberegning (ikke et hånd-cast objekt), så
    // feltdrift fanges og de assertede beløb er ægte beregnede værdier. Samme input som
    // forsoergertabCalculation.test.ts' hovedcase (giver ikke-null asl/eal-computation).
    const calc = computeForsoergertabCalculation({ ealBlocked: false, aslBlocked: false,
      skadedato: toISODateString('2020-05-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1973-01-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-01-01'),
      koen: 'Kvinde',
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(450000),
      ealAarsloen: asAmount(450000),
    });
    expect(calc.result).not.toBeNull();
    expect(calc.aslComputation).not.toBeNull();
    expect(calc.ealComputation).not.toBeNull();

    const { documentXml } = await renderWordDocument((session) => {
      return generateForsoergertabDocument(session, {
        grundlaeggende: {
          beregningsdato: toISODateString('2026-03-19'),
          skadelidteFodselsdato: toISODateString('1980-01-01'),
          skadedato: toISODateString('2020-05-01'),
          skadestype: 'Arbejdsulykke' as const,
          efterladteFodselsdato: toISODateString('1973-01-01'),
          koen: 'Kvinde',
          visKoenValg: true,
          aslAarsloen: 450000,
          ealAarsloen: 450000,
          virkningsdato: toISODateString('2025-01-01'),
          tilkendtForPeriodeAar: 10,
        },
        result: calc.result,
        ealComputation: calc.ealComputation,
        aslComputation: calc.aslComputation,
        foersoergertabEalMinSatsOre: calc.foersoergertabEalMinSatsOre,
        foersoergertabForhoejtetTilMin: calc.foersoergertabForhoejtetTilMin,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Beregnet forsørgertab');
    expect(text).toContain('EAL-krav');
    // Konkrete beregnede beløb skal nå .docx'en (bundet til den faktiske beregning,
    // ikke hardcodede tal): forsørgertabserstatningen (nettokrav) og EAL-kravet.
    expect(text).toContain(formatKr(calc.result!.nettokrav));
    expect(text).toContain(formatKr(calc.result!.ealKrav));
    expect(text).toContain('Resterende periode (hele år og måneder)');
    expect(text).toContain(`${calc.aslComputation!.resterendeAar} år og ${calc.aslComputation!.resterendeMaaneder} måneder`);
    // EAL-mellemregningen (reguleret årsløn x faktor x 30 %) skal være til stede.
    expect(text).toContain(`x ${calc.ealComputation!.kapitaliseringsfaktor} x 30 %`);
  });
});
