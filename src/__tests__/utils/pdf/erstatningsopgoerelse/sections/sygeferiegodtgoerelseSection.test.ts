import { describe, expect, it } from 'vitest';
import { assertNoUnsupportedSygeferiegodtgoerelseSelection } from '../../../../../utils/pdf/erstatningsopgoerelse/sections/sygeferiegodtgoerelseSection';
import type { SelectedElements } from '../../../../../utils/pdf/erstatningsopgoerelse/types';

const makeSelected = (overrides: Partial<SelectedElements>): SelectedElements => ({
  opgoerelse: false,
  loenindkomst: false,
  offentligeYdelser: false,
  shDage: false,
  regulering: false,
  okSatser: false,
  sygeferiegodtgoerelse: false,
  ...overrides,
});

describe('assertNoUnsupportedSygeferiegodtgoerelseSelection', () => {
  it('kaster ikke fejl når sygeferiegodtgoerelse er false', () => {
    const selected = makeSelected({ sygeferiegodtgoerelse: false });
    expect(() => assertNoUnsupportedSygeferiegodtgoerelseSelection(selected)).not.toThrow();
  });

  it('kaster fejl når sygeferiegodtgoerelse er true', () => {
    const selected = makeSelected({ sygeferiegodtgoerelse: true });
    expect(() => assertNoUnsupportedSygeferiegodtgoerelseSelection(selected)).toThrow(
      'Valgte PDF-elementer er ikke understøttet endnu: Sygeferiegodtgørelse.'
    );
  });

  it('kaster fejl uanset andre valgte elementer', () => {
    const selected = makeSelected({
      opgoerelse: true,
      loenindkomst: true,
      offentligeYdelser: true,
      sygeferiegodtgoerelse: true,
    });
    expect(() => assertNoUnsupportedSygeferiegodtgoerelseSelection(selected)).toThrow();
  });

  it('returnerer ikke en værdi (void)', () => {
    const selected = makeSelected({ sygeferiegodtgoerelse: false });
    const result = assertNoUnsupportedSygeferiegodtgoerelseSelection(selected);
    expect(result).toBeUndefined();
  });
});
