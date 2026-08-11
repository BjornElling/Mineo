import {
  formatAnvendtReguleringsdatoInfoTooltip,
  resolveAnvendtReguleringsdatoReferenceText,
} from '../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';
import { toISODateString } from '../../../types/branded';

const baseParams = {
  skadedato: toISODateString('2024-06-01'),
  skadestype: 'Arbejdsulykke' as const,
  beregnesUdFra: 'Beregningsperiode' as const,
  beregningsperiodeTil: toISODateString('2024-12-31'),
  saerligFraDatoRegulering: undefined,
};

describe('eoDateReferenceText', () => {
  describe('resolveAnvendtReguleringsdatoReferenceText', () => {
    it('beskriver skadedatoen med dato', () => {
      expect(resolveAnvendtReguleringsdatoReferenceText({
        ...baseParams,
        anvendtReguleringsdato: baseParams.skadedato,
      })).toBe('skadedatoen (01-06-2024)');
    });

    it('beskriver beregningsperiodens slutdato med dato', () => {
      expect(resolveAnvendtReguleringsdatoReferenceText({
        ...baseParams,
        anvendtReguleringsdato: baseParams.beregningsperiodeTil,
      })).toBe('beregningsperiodens udløb (31-12-2024)');
    });
  });

  describe('formatAnvendtReguleringsdatoInfoTooltip', () => {
    it('forklarer det aktuelle grundlag og datoen', () => {
      expect(formatAnvendtReguleringsdatoInfoTooltip(
        'skadedatoen (01-06-2024)',
        baseParams.skadedato,
      )).toBe('Aktuelt anvendes skadedatoen (01-06-2024).');
    });

    it('forklarer når den aktuelle dato endnu ikke findes', () => {
      expect(formatAnvendtReguleringsdatoInfoTooltip('skadedatoen', undefined))
        .toBe('Aktuelt kan der ikke anvendes en reguleringsdato, fordi skadedatoen ikke er udfyldt.');
    });
  });
});
