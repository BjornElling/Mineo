import { buildIndkomstSectionStatuses } from '../../../domain/eoRowEvaluation/eoRowIndkomstModel';
import { erstatningsopgoerelseValidator } from '../../../validators/erstatningsopgoerelseValidator';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { isFeriePctPaakraevet } from '../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsAssessment';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';

/**
 * Regressionsværn for den KLASSE af fejl, hvor download af erstatningsopgørelsen blokeres UDEN en
 * synlig fejl i «Fejl og advarsler».
 *
 * Feriegodtgørelsen er påkrævet, når kortet har lønoplysninger i procent-tilstand – uanset reguleringsform og
 * beregningsmåde (BB-274). ÉT prædikat (`isFeriePctPaakraevet`) driver både validatorens blokering og
 * række-motorens `satserSkadestidspunkt`-fejlrække. Testen beviser at de to sider ALTID er enige.
 */

const amount = (value: number): AmountValue => ({ kind: 'number', value });

type Grundlag = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]['loenudviklingBeregningsgrundlag'];

const buildScenario = (overrides: Readonly<{
  grundlag: Grundlag;
  beregnesUdFra?: ErstatningsopgoerelseValues['beregnesUdFra'];
  tillaegAngivesSom?: (typeof TILLAEG_ANGIVES_SOM)[keyof typeof TILLAEG_ANGIVES_SOM];
  feriePct?: number;
  medLoenoplysninger?: boolean;
}>): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = overrides.beregnesUdFra ?? 'Beregningsperiode';
  values.loenindkomstAnsaettelsesforhold = [
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      loenudviklingBeregningsgrundlag: overrides.grundlag,
      overenskomstId: 'kl-overenskomst',
      tillaegAngivesSom: overrides.tillaegAngivesSom ?? TILLAEG_ANGIVES_SOM.PROCENT,
      feriePct: overrides.feriePct,
      indtaegtsoplysningerTableData:
        (overrides.medLoenoplysninger ?? true)
          ? [{ id: 'row-1', col0_maaned: '1', col1_maaned: '2024', col2: amount(30000) }]
          : [],
    },
  ];
  return values;
};

const feriePctErrors = (values: ErstatningsopgoerelseValues) =>
  erstatningsopgoerelseValidator
    .validateParsed(values)
    .errors.filter((error) => (error.path ?? '').includes('feriePct') && error.severity === 'error');

/** Blokerer validatoren download pga. manglende feriegodtgørelse? */
const feriePctBlocksInValidator = (values: ErstatningsopgoerelseValues): boolean =>
  feriePctErrors(values).some((error) => error.message.includes('Feriegodtgørelse'));

/** Viser række-motoren en tilsvarende synlig satser-fejl om feriegodtgørelse? */
const feriePctShownInRow = (values: ErstatningsopgoerelseValues): boolean =>
  buildIndkomstSectionStatuses(values).some(
    (section) => section.satserStatus === 'error' && section.satserMessage.includes('Feriegodtgørelse')
  );

const ALLE_GRUNDLAG: readonly Grundlag[] = ['Overenskomst', 'Manuelt angivet', 'Statistik', 'KRL satstabel', 'Ingen', undefined];

describe('feriegodtgørelse: download-blokering ⟺ synlig fejl (ingen usynlig blokering)', () => {
  it.each(ALLE_GRUNDLAG)('manglende feriegodtgørelse blokerer OG vises ved grundlag=%s', (grundlag) => {
    const values = buildScenario({ grundlag });

    expect(feriePctErrors(values)).toEqual([{
      path: 'loenindkomstAnsaettelsesforhold[0].feriePct',
      message: 'Feriegodtgørelse/-tillæg er ikke udfyldt',
      severity: 'error',
    }]);

    const section = buildIndkomstSectionStatuses(values)[0];
    expect(section?.satserStatus).toBe('error');
    // «er ikke udfyldt» – IKKE en afvigelsestekst (intet er indtastet).
    expect(section?.satserMessage).toBe('Feriegodtgørelse/-tillæg er ikke udfyldt');
  });

  it.each<ErstatningsopgoerelseValues['beregnesUdFra']>(['Beregningsperiode', 'Angivet månedsløn'])(
    'kræver feriegodtgørelsen uanset beregningsmåde (%s)',
    (beregnesUdFra) => {
      const values = buildScenario({ grundlag: 'Statistik', beregnesUdFra });
      expect(feriePctBlocksInValidator(values)).toBe(true);
      expect(feriePctShownInRow(values)).toBe(true);
    }
  );

  it('kræver ikke skjult feriegodtgørelse i Beløb-tilstand', () => {
    const values = buildScenario({ grundlag: 'Overenskomst', tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB });
    expect(feriePctBlocksInValidator(values)).toBe(false);
    expect(feriePctShownInRow(values)).toBe(false);
    expect(isFeriePctPaakraevet(values.loenindkomstAnsaettelsesforhold[0])).toBe(false);
  });

  it('kræver ikke feriegodtgørelse uden indtastede lønoplysninger', () => {
    const values = buildScenario({ grundlag: 'Overenskomst', medLoenoplysninger: false });
    expect(feriePctBlocksInValidator(values)).toBe(false);
    expect(feriePctShownInRow(values)).toBe(false);
  });

  it('en gyldig feriegodtgørelse (12 %) hverken blokerer eller giver fejlrække', () => {
    const values = buildScenario({ grundlag: 'Overenskomst', feriePct: 12 });
    expect(feriePctBlocksInValidator(values)).toBe(false);
    expect(buildIndkomstSectionStatuses(values)[0]?.satserStatus).toBe('ok');
  });

  it('en feriegodtgørelse under 12 % giver en rød satsrække', () => {
    const values = buildScenario({ grundlag: 'Overenskomst', feriePct: 10 });
    const section = buildIndkomstSectionStatuses(values)[0];
    expect(section?.satserStatus).toBe('error');
    // Standardkortet har løn under ferie, så teksten er den beregningstekniske omregning.
    expect(section?.satserMessage).toBe(
      'Ved løn under ferie opgøres ferietillægget beregningsteknisk som feriegodtgørelse (12,5 %, eller 15 % ved ret til 6. ferieuge)'
    );
  });

  it('en feriegodtgørelse over 20 % giver en ikke-blokerende advarselsrække', () => {
    const values = buildScenario({ grundlag: 'Overenskomst', feriePct: 25 });
    expect(feriePctBlocksInValidator(values)).toBe(false);
    const section = buildIndkomstSectionStatuses(values)[0];
    expect(section?.satserStatus).toBe('warning');
    expect(section?.satserMessage).toBe('Feriegodtgørelse/-tillæg over 20 % er usædvanligt – kontrollér satsen');
  });
});
