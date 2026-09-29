import { buildPeriodeRaekkeNavn } from '../../../domain/erstatningsopgoerelse/validation/tafRowRules';

describe('buildPeriodeRaekkeNavn', () => {
  it('navngiver en helt tom række uden datoer eller løse feriedage', () => {
    expect(buildPeriodeRaekkeNavn('TAF-perioden', {})).toBe('TAF-perioden uden datoer');
  });
});
