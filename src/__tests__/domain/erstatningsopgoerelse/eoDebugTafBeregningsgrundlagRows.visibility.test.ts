import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildEODebugTafBeregningsgrundlagRows } from '../../../domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(ERSTATNINGSOPGOERELSE_INITIAL_VALUES);
  return { ...base, ...patch };
};

describe('buildEODebugTafBeregningsgrundlagRows visibility', () => {
  it('hides Arbejdsdage when TAF beregnes som is Måneder', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
    });

    const rows = buildEODebugTafBeregningsgrundlagRows(values, {}, STAMDATA_INITIAL_VALUES);
    const ids = new Set(rows.map((row) => row.id));

    expect(ids.has('taf.beregningsgrundlag.arbejdsdage')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.maaneder')).toBe(true);
  });

  it('hides Måneder when TAF beregnes som is Arbejdsdage', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      loenindkomstAnsaettelsesforhold: [
        {
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          fuldLoenUnderFerie: 'Nej',
        },
      ],
    });

    const rows = buildEODebugTafBeregningsgrundlagRows(values, {}, STAMDATA_INITIAL_VALUES);
    const ids = new Set(rows.map((row) => row.id));

    expect(ids.has('taf.beregningsgrundlag.maaneder')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.arbejdsdage')).toBe(true);
  });
});
