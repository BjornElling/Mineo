/**
 * Differencekravets bilagsvalg: et afkrydset felt er et løfte om en side i papiret.
 *
 * Baggrund (BB-188): tre af de fem valg var altid aktive (`unavailableReason={null}`) og udgik enten
 * tavst af dokumentet eller gav en «ingen»-side, mens to andre blev inaktive med årsagen i
 * tooltippet. Netop «Kapitalisering» kunne stå afkrydset og aktivt i en sag helt uden
 * kapitaliseringer, fordi `no-endelig-afgoerelser` bevidst filtreres væk fra fane 5 – og brugeren
 * kunne ikke skelne «bilaget var tomt» fra «noget faldt ud».
 */
import {
  EET_DIFFERENCEKRAV_BILAG_KEYS,
  getEetDifferencekravBilagAvailability,
} from '../../../domain/erhvervsevnetab/eetDifferencekravBilag';
import type { EetDifferencekravComputation } from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';

type Overrides = Partial<Pick<
  EetDifferencekravComputation,
  'loebendeComputation' | 'kapComputation' | 'proformaKapitalisering' | 'resterendeLoebendeYdelser' | 'merErstatningPensionsalder'
>>;

/**
 * Kun de fem felter, opslaget faktisk læser, sættes. Resten af computation'en er uden betydning for
 * tilgængeligheden, og en fuld fixture ville skjule præcis hvilke felter reglen hviler på.
 */
const computationWith = (overrides: Overrides): EetDifferencekravComputation => ({
  loebendeComputation: null,
  kapComputation: null,
  proformaKapitalisering: null,
  resterendeLoebendeYdelser: null,
  merErstatningPensionsalder: null,
  ealComputation: {} as EetDifferencekravComputation['ealComputation'],
  ...overrides,
} as EetDifferencekravComputation);

const withAfgoerelser = (count: number) =>
  ({ afgoerelser: Array.from({ length: count }, (_, index) => ({ rowId: `r${index}` })) });

describe('getEetDifferencekravBilagAvailability', () => {
  it('deaktiverer kapitaliseringsbilaget med en konkret årsag, når sagen ikke har kapitaliseringer', () => {
    const availability = getEetDifferencekravBilagAvailability({
      computation: computationWith({
        loebendeComputation: withAfgoerelser(2) as unknown as EetDifferencekravComputation['loebendeComputation'],
        kapComputation: withAfgoerelser(0) as unknown as EetDifferencekravComputation['kapComputation'],
      }),
      indregnMerErstatningVedForhoejetPensionsalder: true,
      loebendeYdelserBilagValgt: true,
    });

    expect(availability.kapitalisering).toEqual({
      enabled: false,
      disabledReason: 'Der er ingen kapitaliserede afgørelser i sagen',
    });
    expect(availability.loebendeYdelser).toEqual({ enabled: true });
  });

  it('deaktiverer løbende-ydelsesbilaget og den afhængige udvidet-spec-toggle sammen', () => {
    const availability = getEetDifferencekravBilagAvailability({
      computation: computationWith({
        loebendeComputation: withAfgoerelser(0) as unknown as EetDifferencekravComputation['loebendeComputation'],
      }),
      indregnMerErstatningVedForhoejetPensionsalder: true,
      loebendeYdelserBilagValgt: true,
    });

    expect(availability.loebendeYdelser.enabled).toBe(false);
    expect(availability.visUdvidetSpecifikationLoebendeYdelserBilag).toEqual({
      enabled: false,
      disabledReason: 'Der er ingen løbende ydelser i sagen',
    });
  });

  it('deaktiverer udvidet-spec-togglen, når løbende-ydelsesbilaget findes men er fravalgt', () => {
    // Togglen styrede tidligere ingenting i netop denne tilstand: bilaget fravalgt, togglen slået til.
    const availability = getEetDifferencekravBilagAvailability({
      computation: computationWith({
        loebendeComputation: withAfgoerelser(1) as unknown as EetDifferencekravComputation['loebendeComputation'],
      }),
      indregnMerErstatningVedForhoejetPensionsalder: true,
      loebendeYdelserBilagValgt: false,
    });

    expect(availability.loebendeYdelser).toEqual({ enabled: true });
    expect(availability.visUdvidetSpecifikationLoebendeYdelserBilag).toEqual({
      enabled: false,
      disabledReason: 'Bilaget «Løbende ydelser» er fravalgt',
    });
  });

  it('forklarer den manglende kapitalisering på mer-erstatningsbilaget frem for at påstå noget om pensionsalderen', () => {
    const availability = getEetDifferencekravBilagAvailability({
      computation: computationWith({
        kapComputation: withAfgoerelser(0) as unknown as EetDifferencekravComputation['kapComputation'],
      }),
      indregnMerErstatningVedForhoejetPensionsalder: true,
      loebendeYdelserBilagValgt: true,
    });

    expect(availability.merErstatningPensionsalder.enabled).toBe(false);
    expect(availability.merErstatningPensionsalder).toMatchObject({
      disabledReason: 'Der er ingen kapitalisering at forhøje',
    });
  });

  it('fail-closer alle valg uden en beregning', () => {
    const availability = getEetDifferencekravBilagAvailability({
      computation: null,
      indregnMerErstatningVedForhoejetPensionsalder: true,
      loebendeYdelserBilagValgt: true,
    });

    for (const key of EET_DIFFERENCEKRAV_BILAG_KEYS) {
      expect(availability[key].enabled).toBe(false);
    }
  });

  it('giver hvert utilgængeligt valg en årsag – et inaktivt felt uden forklaring er selve fundet', () => {
    const availability = getEetDifferencekravBilagAvailability({
      computation: computationWith({}),
      indregnMerErstatningVedForhoejetPensionsalder: false,
      loebendeYdelserBilagValgt: false,
    });

    for (const key of EET_DIFFERENCEKRAV_BILAG_KEYS) {
      const state = availability[key];
      if (!state.enabled) {
        expect(state.disabledReason.trim()).not.toBe('');
        // Tooltippet er ÉN kort sætning uden punktum (page-component-contract.md §10.5 punkt 3).
        expect(state.disabledReason.endsWith('.')).toBe(false);
      }
    }
  });
});
