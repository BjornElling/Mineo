import { toISODateString } from '../../../types/branded';
import { mergeIsoDateRanges } from '../../../domain/erstatningsopgoerelse/periodMerging';

const iso = (value: string) => toISODateString(value);

describe('periodMerging', () => {
  it('sammenlaegger overlappende og tilstoedende perioder', () => {
    const merged = mergeIsoDateRanges([
      { fra: iso('2020-07-01'), til: iso('2020-07-31') },
      { fra: iso('2020-07-15'), til: iso('2020-08-31') },
      { fra: iso('2020-09-01'), til: iso('2020-09-15') },
    ]);

    expect(merged).toEqual([{ fra: iso('2020-07-01'), til: iso('2020-09-15') }]);
  });
});
