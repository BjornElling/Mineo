import {
  formatAnvendtReguleringsdatoInfoTooltip,
  formatEoDatoReferenceWithDate,
  resolveAnvendtReguleringsdatoReference,
  resolveAnvendtReguleringsdatoReferenceText,
  resolveLoenReferencedatoText,
} from '../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';
import { toISODateString, type ISODateString } from '../../../types/branded';

const baseParams = {
  skadedato: toISODateString('2024-06-01'),
  skadestype: 'Arbejdsulykke' as const,
  beregnesUdFra: 'Beregningsperiode' as const,
  beregningsperiodeTil: toISODateString('2024-12-31'),
  saerligFraDatoRegulering: undefined,
};

const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;

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

    it('beskriver en anden reguleringsdato med den generiske reference', () => {
      expect(resolveAnvendtReguleringsdatoReferenceText({
        ...baseParams,
        anvendtReguleringsdato: toISODateString('2024-07-01'),
      })).toBe('reguleringsdatoen (01-07-2024)');
    });
  });

  describe('resolveAnvendtReguleringsdatoReference', () => {
    it('bruger skadedatoens reference uden en anvendt reguleringsdato', () => {
      expect(resolveAnvendtReguleringsdatoReference({
        ...baseParams,
        anvendtReguleringsdato: undefined,
      })).toMatchObject({
        kind: 'skadedato',
        label: 'Skadedato',
        labelLower: 'skadedatoen',
      });
    });

    it.each([
      ['særlig fra-dato', { saerligFraDatoRegulering: toISODateString('2024-07-01') }],
      ['angivet lønmetodes fra-dato', { angivetLoenMetodeOpreguleresFraDato: toISODateString('2024-07-01') }],
    ])('vælger manuel reference ved %s', (_name, overrides) => {
      expect(resolveAnvendtReguleringsdatoReference({
        ...baseParams,
        ...overrides,
        anvendtReguleringsdato: toISODateString('2024-07-01'),
      })).toEqual({
        kind: 'manuelReguleringsdato',
        label: 'Manuelt angivet reguleringsdato',
        labelLower: 'den manuelt angivne reguleringsdato',
      });
    });
  });

  describe('formatEoDatoReferenceWithDate', () => {
    const reference = {
      kind: 'andenDato' as const,
      label: 'Reguleringsdato',
      labelLower: 'reguleringsdatoen',
    };

    it.each([undefined, invalidIso('0000-00-00')])('viser kun referencen uden en formatterbar dato (%s)', (dato) => {
      expect(formatEoDatoReferenceWithDate(reference, dato)).toBe('reguleringsdatoen');
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

  describe('resolveLoenReferencedatoText', () => {
    it('bruger skadedatoen når lønnen ikke har en anvendt reguleringsdato', () => {
      expect(resolveLoenReferencedatoText({
        subject: 'lønnen',
        anvendtReguleringsdato: undefined,
        skadedato: baseParams.skadedato,
        skadestype: baseParams.skadestype,
      })).toBe('lønnen på skadedatoen');
    });

    it('bruger ved-formen for beregningsperiodens slutdato', () => {
      expect(resolveLoenReferencedatoText({
        subject: 'lønnen',
        ...baseParams,
        anvendtReguleringsdato: baseParams.beregningsperiodeTil,
      })).toBe('lønnen ved beregningsperiodens udløb (31-12-2024)');
    });

    it('bruger på-formen for en anden reguleringsdato', () => {
      expect(resolveLoenReferencedatoText({
        subject: 'lønnen',
        ...baseParams,
        anvendtReguleringsdato: toISODateString('2024-07-01'),
      })).toBe('lønnen på reguleringsdatoen (01-07-2024)');
    });
  });
});
