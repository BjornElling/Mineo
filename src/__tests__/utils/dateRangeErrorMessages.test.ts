import { toISODateString } from '../../types/branded';
import { TODAY } from '../../config/dateRanges';
import { resolveDateRangeErrorMessage } from '../../utils/dateRangeErrorMessages';

const iso = (value: string) => toISODateString(value);

describe('resolveDateRangeErrorMessage', () => {
  it('prioritizes skadesdato message over fra/til message when minBoundKind=skadesdato', () => {
    const message = resolveDateRangeErrorMessage({
      iso: iso('2023-05-02'),
      minDate: iso('2023-08-01'),
      maxDate: iso('2030-12-31'),
      special: { fraTilRole: 'til', minBoundKind: 'skadesdato' },
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
});
