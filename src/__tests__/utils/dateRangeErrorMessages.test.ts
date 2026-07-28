import { toISODateString } from '../../types/branded';
import { TODAY } from '../../config/dateRanges';
import {
  derivedDateBounds,
  resolveDateRangeErrorMessage,
  STATIC_DATE_BOUNDS,
} from '../../utils/dateRangeErrorMessages';

const iso = (value: string) => toISODateString(value);

describe('resolveDateRangeErrorMessage', () => {
  it('umuligt interval (min>max) → forklarende besked med begge grænser, forrang over alt', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2024-06-15'),
      minDate: iso('2024-12-31'),
      maxDate: iso('2024-01-01'),
      // Selv med special-kontekst der ellers ville give en anden besked:
      special: { minBoundKind: 'skadedato', fraTilRole: 'til' },
      bounds: STATIC_DATE_BOUNDS,
    });
    expect(message).toContain('ingen gyldig dato');
    expect(message).toContain('31-12-2024');
    expect(message).toContain('01-01-2024');
  });

  it('prioritizes skadedato message over fra/til message when minBoundKind=skadedato', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2023-05-02'),
      minDate: iso('2023-08-01'),
      maxDate: iso('2030-12-31'),
      special: { fraTilRole: 'til', minBoundKind: 'skadedato' },
      bounds: STATIC_DATE_BOUNDS,
    });
    expect(message).toContain('skadesdagen');
  });

  it('uses erhvervssygdom 5-year message when minBoundKind=anmeldedatoMinus5Aar', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2010-01-01'),
      minDate: iso('2018-08-01'),
      maxDate: iso('2030-12-31'),
      special: { minBoundKind: 'anmeldedatoMinus5Aar', minBoundReferenceISO: iso('2023-08-01') },
      bounds: STATIC_DATE_BOUNDS,
    });
    expect(message).toContain('mere end 5 år før anmeldedatoen');
    expect(message).toContain('01-08-2023');
  });

  it('prioritizes dags dato message over fra/til message when maxDate=TODAY', () => {
    // Use an obviously-future date so it must be after TODAY.
    const message = resolveDateRangeErrorMessage({
      iso: iso('2100-01-01'),
      minDate: iso('2005-01-01'),
      maxDate: TODAY,
      special: { fraTilRole: 'fra' },
      bounds: STATIC_DATE_BOUNDS,
    });
    expect(message).toContain('dags dato');
  });

  it('uses domain-specific kap.dato message when minBoundKind=kapDatoFoerAfgoerelsesdato', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2024-01-09'),
      minDate: iso('2024-01-10'),
      maxDate: iso('2030-12-31'),
      special: { minBoundKind: 'kapDatoFoerAfgoerelsesdato' },
      bounds: STATIC_DATE_BOUNDS,
    });
    expect(message).toContain('Kapitaliseringsdato kan ikke være før afgørelsesdatoen');
  });

  it('uses concrete reference message when minBoundKind=efterAnvendtReguleringsdato', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2024-01-01'),
      minDate: iso('2024-01-02'),
      maxDate: iso('2030-12-31'),
      special: {
        minBoundKind: 'efterAnvendtReguleringsdato',
        minBoundReferenceISO: iso('2024-01-01'),
        minBoundLabel: 'skadedatoen (01-01-2024)',
      },
      bounds: STATIC_DATE_BOUNDS,
    });
    expect(message).toContain('efter skadedatoen');
    expect(message).toContain('01-01-2024');
  });
});

// R3-F03: årsagsinputtene er nu en PÅKRÆVET del af kontrakten, ikke en valgfri ekstra.
//
// Fundet var ikke, at helperen manglede evnen — den kunne allerede tilføje årsagen gennem
// `noValidRangeInputs`. Fejlen var, at feltet var VALGFRIT, så de fleste descriptors udelod det: brugeren fik at
// vide, at ingen dato var gyldig, men ikke hvilke inputs der skulle rettes. Kravet er derfor flyttet til TYPEN
// (`bounds: DateRangeBoundsOrigin`), hvor `derived` tvinger et årsagsnavn frem. Et nyt dynamisk datofelt kan
// dermed ikke længere glemme årsagen uden en compilerfejl.
describe('resolveDateRangeErrorMessage — årsagsinputs i det umulige interval (R3-F03)', () => {
  const impossible = (bounds: Parameters<typeof resolveDateRangeErrorMessage>[0]['bounds']) =>
    resolveDateRangeErrorMessage({
      iso: iso('2024-06-15'),
      minDate: iso('2099-01-01'),
      maxDate: iso('2026-07-28'),
      bounds,
    });

  it('navngiver årsagsinputtene, når grænserne er UDLEDT af andre felter', () => {
    // Fundets egen reproduktion: `skadedato = 2099-01-01` gør både forligsdatoens og øvrige-krav-datoens
    // interval umuligt. Før rettelsen viste beskeden de faktiske grænser, men hverken "Skadedato" eller det
    // andet årsagsinput.
    const message = impossible(derivedDateBounds('Skadedato og Skadestype'));

    expect(message).toContain('ingen gyldig dato');
    expect(message).toContain('01-01-2099');
    expect(message).toContain('28-07-2026');
    expect(message).toContain('Grænserne kommer fra Skadedato og Skadestype.');
  });

  it('nævner ingen årsag for et STATISK interval — der findes intet brugerinput at rette', () => {
    // Et statisk interval kan pr. konstruktion ikke være umuligt; nås grenen alligevel, er det en
    // konfigurationsfejl. At pege på et vilkårligt felt ville da være misvisende.
    const message = impossible(STATIC_DATE_BOUNDS);

    expect(message).toContain('ingen gyldig dato');
    expect(message).not.toContain('Grænserne kommer fra');
  });

  it('tilføjer KUN årsagen i den umulige gren, ikke i en almindelig bounds-fejl', () => {
    // En dato uden for et gyldigt interval er en almindelig fejl; her er årsagen ikke relevant, fordi der
    // FINDES gyldige datoer. Årsagsteksten må ikke sive ud i den besked.
    const message = resolveDateRangeErrorMessage({
      iso: iso('2024-06-15'),
      minDate: iso('2025-01-01'),
      maxDate: iso('2030-12-31'),
      bounds: derivedDateBounds('Skadedato'),
    });

    expect(message).not.toContain('Grænserne kommer fra');
    expect(message).not.toBe('');
  });
});
