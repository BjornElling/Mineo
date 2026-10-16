import { toISODateString } from '../../../types/branded';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { buildLoenudviklingBeregning } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import {
  buildReguleringOpslag,
  buildUreguleretOpslag,
  kraevReguleringPaaDato,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringOpslag';
import type { KonsolideretLoenudvikling } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';

const iso = toISODateString;
const tafRanges = [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }];
const statistik: KonsolideretLoenudvikling = {
  strategi: 'statistik', label: 'SBLON2', statistikModel: 'SBLON2',
  reguleringsdato: iso('2025-01-01'), tafRanges,
};

describe('reguleringOpslag', () => {
  it('skelner lovligt fravalg og manglende løngrundlag fra manglende satsdækning', () => {
    for (const grund of ['ikke-valgt', 'intet-loengrundlag'] as const) {
      const opslag = buildUreguleretOpslag(tafRanges, grund);
      expect(kraevReguleringPaaDato(opslag, iso('2005-01-01'))).toMatchObject({
        udfald: 'ingen-regulering', grund, regulering: { rawFactor: 1, appliedDeltaPct: 0 },
      });
    }
    const opslag = buildReguleringOpslag({
      strategi: { strategi: 'statistik', label: 'SBLON2', konsolideret: statistik },
      baseLoenRounded: 40_000, tafRanges,
      kildeDaekning: { fraIso: iso('2016-01-01'), tilIso: iso('2026-12-31') },
    });
    expect(opslag.paaDato(iso('2015-12-31'))).toEqual({
      udfald: 'uden-for-daekning', dato: iso('2015-12-31'),
      daekning: { fraIso: iso('2016-01-01'), tilIso: iso('2026-12-31') },
    });
    expect(opslag.paaDato(iso('2027-01-01')).udfald).toBe('uden-for-daekning');
    expect(() => kraevReguleringPaaDato(opslag, iso('2015-12-31'))).toThrow('uden for reguleringskildens dækning');
  });

  it('evaluerer samme historiske indeks i og uden for TAF-perioden', () => {
    const opslag = buildReguleringOpslag({
      strategi: { strategi: 'statistik', label: 'SBLON2', konsolideret: statistik },
      baseLoenRounded: 40_000, tafRanges,
      kildeDaekning: { fraIso: iso('2016-01-01'), tilIso: iso('2026-12-31') },
    });
    // SBLON2: 111,9 i 2022, 119,6 i 2024 og 125,4 i 2025.
    expect(kraevReguleringPaaDato(opslag, iso('2022-03-01'))).toMatchObject({
      udfald: 'reguleret', regulering: { referenceValue: 125.4, periodValue: 111.9, appliedDeltaPct: -10.77 },
    });
    expect(kraevReguleringPaaDato(opslag, iso('2024-03-01'))).toEqual(opslag.segmenter[0].vaerdi);
  });

  it('beholder reguleringstrin uden arbejdsdage før TAF filtrerer dem væk', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    values.dagsloenenUdgoer = { kind: 'number', value: 1_000 };
    values.angivetDagsloenOpreguleresFraDato = iso('2022-01-01');
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'SBLON2 (Danmarks Statistik)',
    };
    values.tafPerioder = [{ id: 'taf', fra: iso('2023-12-29'), til: iso('2024-01-05'), loseFeriedage: 0 }];
    values.ferieperioder = [{ id: 'ferie', fra: iso('2023-12-29'), til: iso('2023-12-31') }];
    const resultat = buildLoenudviklingBeregning(
      values, STAMDATA_INITIAL_VALUES, TAF_BEREGNES_SOM.ARBEJDSDAGE, null,
      { tafRanges: [{ fra: iso('2023-12-29'), til: iso('2024-01-05') }] },
    );
    expect(resultat.model.beregnedeSegmenter.map((segment) => segment.fra)).toEqual([iso('2024-01-01')]);
    expect(resultat.reguleringOpslag.faelles?.segmenter.map((segment) => segment.fra)).toEqual([
      iso('2023-12-29'), iso('2024-01-01'),
    ]);
    const vaerdi = resultat.reguleringOpslag.faelles?.paaDato(iso('2023-12-30'));
    expect(vaerdi).toMatchObject({ udfald: 'reguleret', regulering: { periodValue: 115.7, appliedDeltaPct: 3.4 } });
  });

  it('slår manuel reference op på dens egen dato, også når TAF ikke krydser Store Bededags-grænsen', () => {
    const konsolideret: KonsolideretLoenudvikling = {
      strategi: 'manual', label: 'Manuelt angivet', reguleringsdato: iso('2023-01-01'),
      loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: true, feriePct: 0,
      manualRows: [{ id: 'basis', dato: undefined, grundloen: { kind: 'number', value: 100 },
        feriepenge: 0, shSoSats: 0, fritvalg: 0, agPension: 0 }],
      tafRanges: [{ fra: iso('2023-01-01'), til: iso('2023-01-31') }],
    };
    const opslag = buildReguleringOpslag({
      strategi: { strategi: 'manual', label: 'Manuelt angivet', konsolideret },
      baseLoenRounded: 100, tafRanges: konsolideret.tafRanges, kildeDaekning: undefined,
    });
    expect(opslag.manuelBasisDato).toBe(iso('2023-01-01'));
    expect(opslag.paaDato(iso('2022-12-31')).udfald).toBe('uden-for-daekning');
    const vaerdi = kraevReguleringPaaDato(opslag, iso('2024-01-01'));
    expect(vaerdi).toMatchObject({
      udfald: 'reguleret', regulering: { referenceValue: 100, appliedDeltaPct: 0.45 },
    });
    expect(vaerdi.regulering.periodValue).toBeCloseTo(100.45, 10);
  });

  it('bruger samme fremførte slutniveau for en SFGG-reference før TAF og efter kildens nominelle udløb', () => {
    const ranges = [{ fra: iso('2026-12-01'), til: iso('2026-12-31') }];
    const konsolideret: KonsolideretLoenudvikling = {
      strategi: 'krl', label: 'KRL', reguleringsdato: iso('2025-01-01'),
      krlSatstabelId: 'KTO (kommuner)', tafRanges: ranges,
    };
    const opslag = buildReguleringOpslag({
      strategi: { strategi: 'krl', label: 'KRL', konsolideret }, baseLoenRounded: 30_000,
      tafRanges: ranges, kildeDaekning: { fraIso: iso('2005-01-01'), tilIso: iso('2026-09-30') },
    });
    expect(kraevReguleringPaaDato(opslag, iso('2026-10-31'))).toEqual(
      kraevReguleringPaaDato(opslag, iso('2026-12-01')),
    );
    expect(opslag.paaDato(iso('2027-01-01')).udfald).toBe('uden-for-daekning');
  });
});
