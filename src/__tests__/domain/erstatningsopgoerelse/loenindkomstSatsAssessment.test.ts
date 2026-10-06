import {
  assessLoenindkomstSatser,
  FERIE_PCT_ADVARSELSGRAENSE,
  FERIE_PCT_MANGLER_BESKED,
  isFeriePctPaakraevet,
} from '../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsAssessment';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import type { LoenindkomstAnsaettelsesforhold } from '../../../schemas/formSchemas';
import { loenudviklingBeregningsgrundlagEnum } from '../../../schemas/formSchemas/enumSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

/**
 * ÉN sats-vurdering driver både feltmarkeringen og rækken i «Fejl og advarsler».
 *
 * Feriegodtgørelsen er påkrævet, når kortet har lønoplysninger i procent-tilstand – UANSET reguleringsform
 * (BB-274). Testene måler kravet for ALLE reguleringsformer plus den tomme form, og de måler de to undtagelser:
 * Beløb-tilstand og et kort uden lønoplysninger.
 */

const amount = (value: number): AmountValue => ({ kind: 'number', value });

/** Et ansættelsesforhold med indtastede lønoplysninger – forudsætningen for, at satsen kan være påkrævet. */
const employment = (overrides: Partial<LoenindkomstAnsaettelsesforhold> = {}): LoenindkomstAnsaettelsesforhold => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  fuldLoenUnderFerie: 'Nej',
  feriePct: undefined,
  indtaegtsoplysningerTableData: [
    { id: 'row-1', col0_maaned: '1', col1_maaned: '2024', col2: amount(30_000) },
  ],
  ...overrides,
});

describe('isFeriePctPaakraevet – kravet følger kortet, ikke reguleringsformen', () => {
  it.each(loenudviklingBeregningsgrundlagEnum.options)(
    'kræver satsen ved reguleringsformen %s',
    (grundlag) => {
      expect(isFeriePctPaakraevet(employment({ loenudviklingBeregningsgrundlag: grundlag }))).toBe(true);
    }
  );

  it('kræver satsen, også mens reguleringsformen er tom', () => {
    expect(isFeriePctPaakraevet(employment({ loenudviklingBeregningsgrundlag: undefined }))).toBe(true);
  });

  it('kræver ikke satsen i Beløb-tilstand, hvor de skjulte satsfelter ikke er kilden', () => {
    expect(isFeriePctPaakraevet(employment({ tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB }))).toBe(false);
  });

  it('kræver ikke satsen uden indtastede lønoplysninger', () => {
    expect(isFeriePctPaakraevet(employment({ indtaegtsoplysningerTableData: [] }))).toBe(false);
  });

  it('kræver ikke satsen, når lønoplysningsrækkerne mangler ved runtime', () => {
    expect(isFeriePctPaakraevet(employment({ indtaegtsoplysningerTableData: undefined }))).toBe(false);
  });
});

describe('assessLoenindkomstSatser', () => {
  it.each(loenudviklingBeregningsgrundlagEnum.options)(
    'melder en tom feriegodtgørelse som manglende og blokerende ved %s',
    (grundlag) => {
      const findings = assessLoenindkomstSatser(employment({ loenudviklingBeregningsgrundlag: grundlag }));
      expect(findings).toEqual([{
        field: 'feriePct',
        label: 'Feriegodtgørelse/-tillæg',
        kind: 'missing',
        severity: 'error',
        message: 'Feriegodtgørelse/-tillæg er ikke udfyldt',
      }]);
      expect(FERIE_PCT_MANGLER_BESKED).toBe('Feriegodtgørelse/-tillæg er ikke udfyldt');
    }
  );

  it('melder intet uden lønoplysninger', () => {
    expect(assessLoenindkomstSatser(employment({ indtaegtsoplysningerTableData: [] }))).toEqual([]);
  });

  it('melder ikke «ikke udfyldt», når feltet allerede har sin egen feltfejl', () => {
    expect(assessLoenindkomstSatser(employment(), { feriePctHarFeltfejl: true })).toEqual([]);
  });

  it('vejleder om satsens størrelse som rød afvigelse, når den er udfyldt men under 12 %', () => {
    for (const grundlag of loenudviklingBeregningsgrundlagEnum.options) {
      const findings = assessLoenindkomstSatser(employment({ loenudviklingBeregningsgrundlag: grundlag, feriePct: 10 }));
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        kind: 'deviation',
        severity: 'error',
        message: 'Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge',
      });
    }
  });

  it('forklarer feriegodtgørelsen anderledes ved fuld løn under ferie', () => {
    const findings = assessLoenindkomstSatser(employment({ feriePct: 10, fuldLoenUnderFerie: 'Ja' }));
    // Med løn under ferie er ydelsen FERIETILLÆG; den opgøres blot beregningsteknisk som
    // feriegodtgørelse (`feriepenge-begreber-contract.md` regel 2-3).
    expect(findings[0]?.message).toBe(
      'Ved løn under ferie opgøres ferietillægget beregningsteknisk som feriegodtgørelse (12,5 %, eller 15 % ved ret til 6. ferieuge)'
    );
  });

  it.each([12, 12.5, 15, FERIE_PCT_ADVARSELSGRAENSE])('accepterer %s %% uden fund', (feriePct) => {
    expect(assessLoenindkomstSatser(employment({ feriePct }))).toEqual([]);
  });

  it('giver en gul, ikke-blokerende advarsel over 20 %', () => {
    expect(FERIE_PCT_ADVARSELSGRAENSE).toBe(20);
    const findings = assessLoenindkomstSatser(employment({ feriePct: 20.5 }));
    expect(findings).toEqual([{
      field: 'feriePct',
      label: 'Feriegodtgørelse/-tillæg',
      kind: 'unusual',
      severity: 'warning',
      message: 'Feriegodtgørelse/-tillæg over 20 % er usædvanligt – kontrollér satsen',
    }]);
  });

  it('vurderer ikke de skjulte satsfelter i Beløb-tilstand', () => {
    expect(assessLoenindkomstSatser(employment({ tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB, feriePct: 5 }))).toEqual([]);
    expect(assessLoenindkomstSatser(employment({ tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB }))).toEqual([]);
  });
});
