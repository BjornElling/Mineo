import { describe, expect, it } from 'vitest';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import {
  EO_ANGIVET_LOEN_ID,
  getAngivetLoenBaseretPaa,
  getAngivetLoenOpreguleresFraDato,
  resolveLoenudviklingKilde,
} from '../../../domain/erstatningsopgoerelse/angivetLoenHelpers';

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...structuredClone(ERSTATNINGSOPGOERELSE_INITIAL_VALUES),
  ...patch,
});

describe('angivetLoenHelpers', () => {
  it('uses month-specific basedOn/date for Angivet månedsløn', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      angivetMaanedsloenBaseretPaa: 'Månedskilde',
      angivetMaanedsloenOpreguleresFraDato: '2025-01-01',
      angivetDagsloenBaseretPaa: 'Dagskilde',
      angivetDagsloenOpreguleresFraDato: '2024-01-01',
    });

    expect(getAngivetLoenBaseretPaa(values)).toBe('Månedskilde');
    expect(getAngivetLoenOpreguleresFraDato(values)).toBe('2025-01-01');
  });

  it('uses day-specific basedOn/date for Angivet dagsløn', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      angivetMaanedsloenBaseretPaa: 'Månedskilde',
      angivetMaanedsloenOpreguleresFraDato: '2025-01-01',
      angivetDagsloenBaseretPaa: 'Dagskilde',
      angivetDagsloenOpreguleresFraDato: '2024-01-01',
    });

    expect(getAngivetLoenBaseretPaa(values)).toBe('Dagskilde');
    expect(getAngivetLoenOpreguleresFraDato(values)).toBe('2024-01-01');
  });

  it('uses EO lønudvikling source for Angivet* and does not depend on employments', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      loenindkomstAnsaettelsesforhold: [],
      eoAngivetLoenLoenudvikling: {
        ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    });

    const rows = resolveLoenudviklingKilde(values);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(EO_ANGIVET_LOEN_ID);
    expect(rows[0].loenudviklingBeregningsgrundlag).toBe('Ingen');
  });

  it('uses actual employments for Beregningsperiode', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      loenindkomstAnsaettelsesforhold: [
        { ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0], id: 'a1' },
        { ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0], id: 'a2' },
      ],
    });

    const rows = resolveLoenudviklingKilde(values);
    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2']);
  });
});
