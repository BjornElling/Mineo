import { describe, expect, it } from 'vitest';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { persistenceSchemas } from '../../../config/persistenceRegistry';

describe('STAMDATA_INITIAL_VALUES', () => {
  it('er gyldigt iht. stamdata-schema', () => {
    const result = persistenceSchemas.stamdata.safeParse(STAMDATA_INITIAL_VALUES);
    expect(result.success).toBe(true);
  });

  it('tekstfelter er tomme strenge', () => {
    expect(STAMDATA_INITIAL_VALUES.journalnr).toBe('');
    expect(STAMDATA_INITIAL_VALUES.advokat).toBe('');
    expect(STAMDATA_INITIAL_VALUES.sagsbehandler).toBe('');
    expect(STAMDATA_INITIAL_VALUES.skadelidte).toBe('');
  });

  it('valgfrie dato/type-felter er undefined', () => {
    expect(STAMDATA_INITIAL_VALUES.skadestype).toBeUndefined();
    expect(STAMDATA_INITIAL_VALUES.skadesdato).toBeUndefined();
  });

  it('indeholder præcis de forventede nøgler', () => {
    const keys = Object.keys(STAMDATA_INITIAL_VALUES);
    expect(keys).toContain('journalnr');
    expect(keys).toContain('advokat');
    expect(keys).toContain('sagsbehandler');
    expect(keys).toContain('skadelidte');
    expect(keys).toContain('skadestype');
    expect(keys).toContain('skadesdato');
  });
});
