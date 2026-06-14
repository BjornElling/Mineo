import { toISODateString } from '../../types/branded';
import { TODAY } from '../../config/dateRanges';
import { resolveDateRangeErrorMessage } from '../../utils/dateRangeErrorMessages';

const iso = (value: string) => toISODateString(value);

describe('resolveDateRangeErrorMessage', () => {
  it('umuligt interval (min>max) → forklarende besked med begge grænser, forrang over alt', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2024-06-15'),
      minDate: iso('2024-12-31'),
      maxDate: iso('2024-01-01'),
      // Selv med special-kontekst der ellers ville give en anden besked:
      special: { minBoundKind: 'skadedato', fraTilRole: 'til' },
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
    });
    expect(message).toContain('skadesdagen');
  });

  it('uses erhvervssygdom 5-year message when minBoundKind=anmeldedatoMinus5Aar', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2010-01-01'),
      minDate: iso('2018-08-01'),
      maxDate: iso('2030-12-31'),
      special: { minBoundKind: 'anmeldedatoMinus5Aar', minBoundReferenceISO: iso('2023-08-01') },
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
    });
    expect(message).toContain('dags dato');
  });

  it('uses domain-specific kap.dato message when minBoundKind=kapDatoFoerAfgoerelsesdato', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2024-01-09'),
      minDate: iso('2024-01-10'),
      maxDate: iso('2030-12-31'),
      special: { minBoundKind: 'kapDatoFoerAfgoerelsesdato' },
    });
    expect(message).toContain('Kapitaliseringsdato kan ikke være før afgørelsesdatoen');
  });
});
