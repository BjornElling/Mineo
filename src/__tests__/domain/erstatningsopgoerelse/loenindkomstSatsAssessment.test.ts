import {
  assessLoenindkomstSatser,
  isFeriePctRelevant,
  resolveSatserErrorField,
} from '../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsAssessment';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import type { ErstatningsopgoerelseValues, LoenindkomstAnsaettelsesforhold } from '../../../schemas/formSchemas';
import { loenudviklingBeregningsgrundlagEnum } from '../../../schemas/formSchemas/enumSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

/**
 * ÉN sats-vurdering driver både feltmarkeringen og blokeringen.
 *
 * Testene måler den godkendte relevansmatrix eksplicit for ALLE syv reguleringsformer plus den tomme form,
 * og de måler skift begge veje mellem et krævende og et ikke-krævende spor. Det er netop den drift, fundet
 * beskrev: feltvejen krævede feriegodtgørelse ved enhver form, mens gatevejen kun krævede den ved to.
 */

type Grundlag = LoenindkomstAnsaettelsesforhold['loenudviklingBeregningsgrundlag'];

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

const ctx = (
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'] = 'Beregningsperiode'
) => ({ beregnesUdFra });

/** De to former, hvis opregulering faktisk læser feriegodtgørelsen. */
const KRAEVENDE_FORMER: readonly Grundlag[] = ['Overenskomst', 'Manuelt angivet'];

describe('isFeriePctRelevant – den godkendte relevansmatrix', () => {
  it.each(loenudviklingBeregningsgrundlagEnum.options)(
    'afgør relevansen korrekt for reguleringsformen %s',
    (grundlag) => {
      const af = employment({ loenudviklingBeregningsgrundlag: grundlag });
      expect(isFeriePctRelevant(af, 'Beregningsperiode')).toBe(KRAEVENDE_FORMER.includes(grundlag));
    }
  );

  it('kræver ikke satsen, mens reguleringsformen er tom', () => {
    // En tom form blokerer i stedet som et manglende reguleringsvalg – det valg markeres, ikke satsen.
    const af = employment({ loenudviklingBeregningsgrundlag: undefined });
    expect(isFeriePctRelevant(af, 'Beregningsperiode')).toBe(false);
  });

  it('kræver ikke satsen i Beløb-tilstand, hvor de skjulte satsfelter ikke er kilden', () => {
    const af = employment({
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
    });
    expect(isFeriePctRelevant(af, 'Beregningsperiode')).toBe(false);
  });

  it('kræver ikke satsen uden indtastede lønoplysninger', () => {
    const af = employment({ loenudviklingBeregningsgrundlag: 'Overenskomst', indtaegtsoplysningerTableData: [] });
    expect(isFeriePctRelevant(af, 'Beregningsperiode')).toBe(false);
  });

  it('kræver ikke satsen, når årslønnen ikke bygger på en beregningsperiode', () => {
    const af = employment({ loenudviklingBeregningsgrundlag: 'Overenskomst' });
    expect(isFeriePctRelevant(af, 'Angivet månedsløn')).toBe(false);
  });
});

describe('assessLoenindkomstSatser', () => {
  it.each(loenudviklingBeregningsgrundlagEnum.options.filter((g) => !KRAEVENDE_FORMER.includes(g)))(
    'markerer IKKE en tom feriegodtgørelse ved %s',
    (grundlag) => {
      const findings = assessLoenindkomstSatser(
        employment({ loenudviklingBeregningsgrundlag: grundlag }),
        ctx()
      );
      expect(findings).toEqual([]);
    }
  );

  it.each(KRAEVENDE_FORMER)('markerer en tom feriegodtgørelse ved %s', (grundlag) => {
    const findings = assessLoenindkomstSatser(
      employment({ loenudviklingBeregningsgrundlag: grundlag }),
      ctx()
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      field: 'feriePct',
      kind: 'missing',
      message: 'Feriegodtgørelse/-tillæg skal udfyldes',
    });
  });

  it('slår markeringen til og fra ved skift begge veje mellem et krævende og et ikke-krævende spor', () => {
    const base = employment();
    // Ikke-krævende → krævende: manglen bliver straks synlig.
    expect(assessLoenindkomstSatser({ ...base, loenudviklingBeregningsgrundlag: 'Statistik' }, ctx())).toEqual([]);
    expect(assessLoenindkomstSatser({ ...base, loenudviklingBeregningsgrundlag: 'Overenskomst' }, ctx()))
      .toHaveLength(1);
    // Krævende → ikke-krævende: netop denne mangel ophører. Værdien bevares som brugerinput, men læses ikke.
    expect(assessLoenindkomstSatser({ ...base, loenudviklingBeregningsgrundlag: 'Ingen' }, ctx())).toEqual([]);
  });

  it('vejleder om satsens størrelse, når den er udfyldt men under 12 % – uanset reguleringsform', () => {
    // Vejledningen hænger ikke på relevansen: har brugeren SELV skrevet en værdi, er den for lav uanset form.
    for (const grundlag of loenudviklingBeregningsgrundlagEnum.options) {
      const findings = assessLoenindkomstSatser(
        employment({ loenudviklingBeregningsgrundlag: grundlag, feriePct: 10 }),
        ctx()
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]?.kind).toBe('deviation');
      expect(findings[0]?.message).toBe('Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge');
    }
  });

  it('forklarer feriegodtgørelsen anderledes ved fuld løn under ferie', () => {
    const findings = assessLoenindkomstSatser(
      employment({ loenudviklingBeregningsgrundlag: 'Overenskomst', feriePct: 10, fuldLoenUnderFerie: 'Ja' }),
      ctx()
    );
    expect(findings[0]?.message).toBe(
      'Løn under ferie beregnes som feriegodtgørelse (12,5 % eller 15 % ved ret til 6. ferieuge)'
    );
  });

  it('giver intet fund ved 12 % eller derover', () => {
    expect(assessLoenindkomstSatser(
      employment({ loenudviklingBeregningsgrundlag: 'Overenskomst', feriePct: 12.5 }),
      ctx()
    )).toEqual([]);
  });

  it('vurderer ikke de skjulte satsfelter i Beløb-tilstand', () => {
    expect(assessLoenindkomstSatser(
      employment({
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
        feriePct: 5,
      }),
      ctx()
    )).toEqual([]);
  });
});

describe('resolveSatserErrorField – samme vurdering, boksens formulering', () => {
  it('siger "ikke udfyldt" om en manglende værdi, ikke "forkert indtastet"', () => {
    const error = resolveSatserErrorField(
      employment({ loenudviklingBeregningsgrundlag: 'Overenskomst' }),
      'Beregningsperiode'
    );
    expect(error).toEqual({
      field: 'Feriegodtgørelse/-tillæg',
      message: 'Feriegodtgørelse/-tillæg er ikke udfyldt',
      kind: 'missing',
    });
  });

  it('siger "forkert værdi indtastet" om en for lav sats', () => {
    const error = resolveSatserErrorField(
      employment({ loenudviklingBeregningsgrundlag: 'Overenskomst', feriePct: 10 }),
      'Beregningsperiode'
    );
    expect(error?.kind).toBe('deviation');
    expect(error?.message).toBe('Forkert værdi indtastet i Feriegodtgørelse/-tillæg');
  });

  it('blokerer ikke, hvor vurderingen ikke markerer – feltmarkering og blokering kan ikke drifte', () => {
    // Dette er fundets kerne: de to sider læser NU samme vurdering, så en tom liste og en null-blokering
    // følges altid. Krævede gaten mere eller mindre end markeringen, ville netop denne løkke fange det.
    for (const grundlag of loenudviklingBeregningsgrundlagEnum.options) {
      const af = employment({ loenudviklingBeregningsgrundlag: grundlag });
      const marked = assessLoenindkomstSatser(af, ctx()).length > 0;
      const blocked = resolveSatserErrorField(af, 'Beregningsperiode') !== null;
      expect(blocked).toBe(marked);
    }
  });
});
