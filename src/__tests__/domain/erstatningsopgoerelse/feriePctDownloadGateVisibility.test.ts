import { buildIndkomstSectionStatuses } from '../../../domain/eoRowEvaluation/eoRowIndkomstModel';
import { erstatningsopgoerelseValidator } from '../../../validators/erstatningsopgoerelseValidator';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { isFeriePctRequiredForBlocking } from '../../../domain/erstatningsopgoerelse/validation/loenindkomstSatserGate';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';

/**
 * Regressionsværn for den KLASSE af fejl, hvor download af erstatningsopgørelsen blokeres UDEN en
 * synlig fejl i "Fejl og advarsler".
 *
 * Konkret rapporteret fejl: manglende feriegodtgørelses-/tillægs-procent (`feriePct`). Validatoren
 * kræver den (→ blokerende snapshot-invariant → download blokeret + tooltip), men den autoritative
 * række-motor (`collectAllEoRows` via `buildIndkomstSectionStatuses`) reproducerede den ikke, så boksen
 * forblev tom.
 *
 * Kernen i rettelsen er ÉT sandt sted for "hvornår kræves feriegodtgørelse" (`isFeriePctRequiredForBlocking`),
 * der driver BEGGE sider. Denne test beviser at de to sider ALTID er enige: validatorens blokering ⟺
 * en synlig `satserSkadestidspunkt`-fejlrække. Hvis de nogensinde drifter igen, bliver testen rød.
 */

const amount = (value: number): AmountValue => ({ kind: 'number', value });

type Grundlag = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]['loenudviklingBeregningsgrundlag'];

const buildScenario = (overrides: Readonly<{
  grundlag: Grundlag;
  tillaegAngivesSom?: (typeof TILLAEG_ANGIVES_SOM)[keyof typeof TILLAEG_ANGIVES_SOM];
  feriePct?: number;
  medLoenoplysninger?: boolean;
}>): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = 'Beregningsperiode';
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

/** Blokerer validatoren download pga. manglende feriegodtgørelse? */
const feriePctBlocksInValidator = (values: ErstatningsopgoerelseValues): boolean =>
  erstatningsopgoerelseValidator
    .validateParsed(values)
    .errors.some(
      (error) =>
        (error.path ?? '').includes('feriePct') &&
        error.severity === 'error' &&
        error.message.includes('Feriegodtgørelse')
    );

/** Viser række-motoren en tilsvarende synlig satser-fejl om feriegodtgørelse? */
const feriePctShownInRow = (values: ErstatningsopgoerelseValues): boolean =>
  buildIndkomstSectionStatuses(values, undefined).some(
    (section) => section.satserStatus === 'error' && section.satserMessage.includes('Feriegodtgørelse')
  );

describe('feriegodtgørelse: download-blokering ⟺ synlig fejl (ingen usynlig blokering)', () => {
  it('manglende feriegodtgørelse (Overenskomst) blokerer OG vises med en "ikke udfyldt"-besked', () => {
    const values = buildScenario({ grundlag: 'Overenskomst' });

    expect(feriePctBlocksInValidator(values)).toBe(true);

    const section = buildIndkomstSectionStatuses(values, undefined)[0];
    expect(section?.satserStatus).toBe('error');
    // "er ikke udfyldt" — IKKE "Forkert værdi indtastet" (intet er indtastet).
    expect(section?.satserMessage).toBe('Feriegodtgørelse/-tillæg er ikke udfyldt');
  });

  it('manglende feriegodtgørelse (Manuelt angivet) blokerer OG vises', () => {
    const values = buildScenario({ grundlag: 'Manuelt angivet' });
    expect(feriePctBlocksInValidator(values)).toBe(true);
    expect(feriePctShownInRow(values)).toBe(true);
  });

  it.each<Grundlag>(['Overenskomst', 'Manuelt angivet', 'Statistik', 'KRL satstabel', 'Ingen'])(
    'validator og række-motor er enige for grundlag=%s (ingen usynlig blokering)',
    (grundlag) => {
      const values = buildScenario({ grundlag });
      expect(feriePctShownInRow(values)).toBe(feriePctBlocksInValidator(values));
    }
  );

  it('kræver ikke skjult feriegodtgørelse i Beløb-tilstand', () => {
    // Beløb-tilstand skjuler top-satsfelterne, så manglende feriePct må hverken blokere download
    // eller give en usynlig fejlrække.
    const values = buildScenario({ grundlag: 'Overenskomst', tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB });
    expect(feriePctBlocksInValidator(values)).toBe(false);
    expect(feriePctShownInRow(values)).toBe(false);
    expect(isFeriePctRequiredForBlocking(values.loenindkomstAnsaettelsesforhold[0], values.beregnesUdFra)).toBe(false);
  });

  it('kræver ikke feriegodtgørelse uden indtastede lønoplysninger', () => {
    const values = buildScenario({ grundlag: 'Overenskomst', medLoenoplysninger: false });
    expect(feriePctBlocksInValidator(values)).toBe(false);
    expect(feriePctShownInRow(values)).toBe(false);
  });

  it('en gyldig feriegodtgørelse (≥12 %) hverken blokerer eller giver fejlrække', () => {
    const values = buildScenario({ grundlag: 'Overenskomst', feriePct: 12.5 });
    expect(feriePctBlocksInValidator(values)).toBe(false);
    expect(feriePctShownInRow(values)).toBe(false);
  });
});
