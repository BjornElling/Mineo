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

const BP = { beregnesUdFra: 'Beregningsperiode' } as const;
const ANGIVET = { beregnesUdFra: 'Angivet månedsløn' } as const;

describe('assessLoenindkomstSatser', () => {
  it.each(loenudviklingBeregningsgrundlagEnum.options)(
    'melder en tom feriegodtgørelse som manglende og blokerende ved %s',
    (grundlag) => {
      const findings = assessLoenindkomstSatser(employment({ loenudviklingBeregningsgrundlag: grundlag }), BP);
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
    expect(assessLoenindkomstSatser(employment({ indtaegtsoplysningerTableData: [] }), BP)).toEqual([]);
  });

  it('melder ikke «ikke udfyldt», når feltet allerede har sin egen feltfejl', () => {
    expect(assessLoenindkomstSatser(employment(), { ...BP, feriePctHarFeltfejl: true })).toEqual([]);
  });

  // Udviklerafgørelse 2026-11-04: under 12 % er satsen et FERIETILLÆG. Erstatningsopgørelsen kræver beregningsteknisk
  // feriegodtgørelse også ved løn under ferie, men et ferietillæg kan i sjældne tilfælde være rigtigt – derfor gult.
  it.each([0, 1, 2.95, 11.99])('giver en gul advarsel om et ferietillæg på %s %% ved løn under ferie', (feriePct) => {
    const findings = assessLoenindkomstSatser(employment({ feriePct, fuldLoenUnderFerie: 'Ja' }), BP);
    expect(findings).toEqual([expect.objectContaining({ kind: 'unusual', severity: 'warning' })]);
    expect(findings[0]?.message).toMatch(/^Ferietillæg på /);
  });

  it('navngiver ferietillægget og vejleder om den beregningstekniske feriegodtgørelse', () => {
    const findings = assessLoenindkomstSatser(employment({ feriePct: 1, fuldLoenUnderFerie: 'Ja' }), BP);
    expect(findings[0]?.message).toBe(
      'Ferietillæg på 1 %: i erstatningsopgørelsen angives løn under ferie normalt beregningsteknisk som '
        + 'feriegodtgørelse – 12,5 %, eller 15 % ved ret til 6. ferieuge, plus et eventuelt forhøjet ferietillæg'
    );
  });

  it('gør et ferietillæg rødt og blokerende, når brugeren har svaret Nej til fuld løn under ferie', () => {
    const findings = assessLoenindkomstSatser(employment({ feriePct: 1, fuldLoenUnderFerie: 'Nej' }), BP);
    expect(findings).toEqual([expect.objectContaining({
      kind: 'deviation',
      severity: 'error',
      message: 'Ferietillæg på 1 % forudsætter løn under ferie, men «Fuld løn under ferie» er Nej. '
        + 'Uden løn under ferie angives feriegodtgørelsen: typisk 12,5 %, eller 15 % ved ret til 6. ferieuge',
    })]);
  });

  it('læser ikke et skjult «Fuld løn under ferie»: uden beregningsperiode er et ferietillæg kun gult', () => {
    // Skjult giver readeren valget som tomværdien «Nej»; det må ikke gøre satsen rød.
    const findings = assessLoenindkomstSatser(employment({ feriePct: 1, fuldLoenUnderFerie: 'Nej' }), ANGIVET);
    expect(findings).toEqual([expect.objectContaining({ kind: 'unusual', severity: 'warning' })]);
  });

  it.each([12, 12.5, 15, 16.95, FERIE_PCT_ADVARSELSGRAENSE])('accepterer feriegodtgørelse på %s %% uden fund', (feriePct) => {
    expect(assessLoenindkomstSatser(employment({ feriePct }), BP)).toEqual([]);
    expect(assessLoenindkomstSatser(employment({ feriePct, fuldLoenUnderFerie: 'Ja' }), BP)).toEqual([]);
  });

  it('giver en gul, ikke-blokerende advarsel over 20 %', () => {
    expect(FERIE_PCT_ADVARSELSGRAENSE).toBe(20);
    const findings = assessLoenindkomstSatser(employment({ feriePct: 20.5 }), BP);
    expect(findings).toEqual([{
      field: 'feriePct',
      label: 'Feriegodtgørelse/-tillæg',
      kind: 'unusual',
      severity: 'warning',
      message: 'Feriegodtgørelse over 20 % er usædvanligt – kontrollér satsen',
    }]);
  });

  it.each([false, true])('advarser om den høje feriesats både med og uden overenskomst (overenskomst: %s)', (harOverenskomst) => {
    const findings = assessLoenindkomstSatser(employment({ feriePct: 25, harOverenskomst, overenskomstId: harOverenskomst ? 'bygge-anlaeg' : undefined }), BP);
    expect(findings).toEqual([expect.objectContaining({ kind: 'unusual', severity: 'warning' })]);
  });

  it('vurderer ikke de skjulte satsfelter i Beløb-tilstand', () => {
    expect(assessLoenindkomstSatser(employment({ tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB, feriePct: 5 }), BP)).toEqual([]);
    expect(assessLoenindkomstSatser(employment({ tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB }), BP)).toEqual([]);
  });
});
