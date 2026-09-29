import { buildOverenskomstSegmentContext } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstSegmentContext';
import type { KonsolideretOverenskomst } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstSegmentContext';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const invalidIso = 'ikke-en-dato' as ISODateString;
const tafRanges = [{ fra: iso('2024-04-01'), til: iso('2025-03-31') }];

const createKonsolideret = (
  overrides: Partial<KonsolideretOverenskomst> = {}
): KonsolideretOverenskomst => ({
  strategi: 'overenskomst',
  label: 'Overenskomst',
  reguleringsdato: iso('2024-04-01'),
  overenskomstId: 'bygge-anlaeg',
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
  beregnStoreBededagstillaeg: false,
  feriePct: 0,
  fritvalgPct: 0,
  shSoPct: 0,
  pensionPct: 0,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  harAnciennitetstillaegEfterSkadedatoen: false,
  anciennitetstillaegDato: undefined,
  anciennitetstillaegSatsAngivesPer: 'Måned',
  anciennitetstillaegSatsValue: undefined,
  offentligLoenEkstraGrundloen: 0,
  offentlig: null,
  tafRanges,
  ...overrides,
});

describe('buildOverenskomstSegmentContext', () => {
  it('bygger fælles kontekst og aktiverer et gyldigt anciennitetstillæg', () => {
    const result = buildOverenskomstSegmentContext(createKonsolideret({
      harAnciennitetstillaegEfterSkadedatoen: true,
      anciennitetstillaegDato: iso('2024-06-01'),
      anciennitetstillaegSatsValue: 125,
    }));

    expect(result.reguleringsdatoIso).toBe(iso('2024-04-01'));
    expect(result.reguleringsdatoDa).toBe('01-04-2024');
    expect(result.overenskomstRef.baseId).toBe('bygge-anlaeg');
    expect(result.anciennitetForIndex).toMatchObject({
      activeFromIso: iso('2024-06-01'),
      supplementValue: expect.any(Number),
    });
  });

  it('returnerer ingen anciennitet ved tomme TAF-ranges', () => {
    expect(buildOverenskomstSegmentContext(createKonsolideret({ tafRanges: [] })).anciennitetForIndex)
      .toBeNull();
  });

  it('afviser manglende reguleringsdato, manglende overenskomst og ugyldig dato', () => {
    expect(() => buildOverenskomstSegmentContext(createKonsolideret({ reguleringsdato: undefined })))
      .toThrow('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
    expect(() => buildOverenskomstSegmentContext(createKonsolideret({ overenskomstId: '' })))
      .toThrow('Loenudvikling kan ikke beregnes: overenskomst mangler');
    expect(() => buildOverenskomstSegmentContext(createKonsolideret({ reguleringsdato: invalidIso })))
      .toThrow('Loenudvikling kan ikke beregnes: ugyldig reguleringsdato');
  });
});
