import { buildRegulationInspektionSections } from '../../../domain/eoInspektion/eoInspektionRegulationViewModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { moneyOre } from '../../../domain/money/money';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { EoCanonicalOutput } from '../../../domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import type { RegulationIndexTimeline } from '../../../domain/eoInspektion/eoInspektionRegulationTypes';

const iso = (value: string): ISODateString => toISODateString(value);

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.beregnesUdFra = 'Beregningsperiode';
  values.loenindkomstAnsaettelsesforhold = [{
    ...values.loenindkomstAnsaettelsesforhold[0]!,
    id: 'af-kl-canonical',
    navnPaaArbejdssted: 'KL canonical',
    loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
  }];
  return values;
};

const buildTimeline = (): RegulationIndexTimeline => ({
  tafBeregningsenhed: 'Måneder',
  ansaettelser: [{
    ansaettelsesforholdId: 'af-kl-canonical',
    navn: 'KL canonical',
    kildeLabel: 'KL-lønaftaler',
    kildeVaerdi: 'KL-lønaftaler',
    referenceIso: iso('2024-01-01'),
    referenceLabel: 'Skadedato',
    referenceValue: 1,
    entries: [],
  }],
});

const buildCanonicalOutput = (): EoCanonicalOutput => ({
  totals: {
    svieSmerteOre: moneyOre(0),
    tabtArbejdsfortjenesteFoerForligOre: moneyOre(0),
    tabtArbejdsfortjenesteOre: moneyOre(0),
    oevrigeKravFoerForligOre: moneyOre(0),
    oevrigeKravOre: moneyOre(0),
    samletTotalOre: moneyOre(0),
  },
  svieSmerte: { maxApplied: false },
  taf: {
    harTafPerioder: true,
    offentligeYdelserUdviklingOre: null,
    tafIndtaegterOre: null,
    tidligereModtagetTafOre: moneyOre(0),
    sygeferiegodtgoerelseOre: moneyOre(0),
  },
  periodiseringer: {
    tafPerioder: [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }],
  },
  regulering: {
    loenudviklingTotalFoerForligOre: moneyOre(0),
    loenudviklingSegmenter: [],
    perAnsaettelse: [{
      ansaettelsesforholdId: 'af-kl-canonical',
      loenudviklingTotalFoerForligOre: moneyOre(0),
      loenudviklingSegmenter: [
        {
          kind: 'maaneder',
          fra: iso('2024-01-01'),
          til: iso('2024-06-30'),
          maaneder: 6,
          maanedsloenOre: moneyOre(100_000),
          deltaPct: 0,
          amountOre: moneyOre(600_000),
          reguleretLoenOre: moneyOre(100_000),
        },
        {
          kind: 'maaneder',
          fra: iso('2024-07-01'),
          til: iso('2024-12-31'),
          maaneder: 6,
          maanedsloenOre: moneyOre(100_000),
          deltaPct: 10,
          amountOre: moneyOre(660_000),
          reguleretLoenOre: moneyOre(110_000),
        },
      ],
    }],
  },
});

describe('CALC-006 – uafhængigt facit for canonical KL-regulering i EO-viewmodel', () => {
  it('viser den beregnede tabel med reguleret månedsløn fra canonical segmenter', () => {
    const sections = buildRegulationInspektionSections({
      timeline: buildTimeline(),
      canonicalOutput: buildCanonicalOutput(),
      eoValues: buildValues(),
      stamdataValues: {
        ...STAMDATA_INITIAL_VALUES,
        skadedato: iso('2024-01-01'),
      },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.tables).toHaveLength(2);
    expect(sections[0]?.tables?.[1]).toEqual({
      id: 'regulation.af-kl-canonical:beregnet',
      columns: ['Fra-dato', 'Til-dato', 'Lønudvikling', 'Reguleret månedsløn'],
      rows: [
        {
          id: 'regulation.af-kl-canonical:beregnet:0',
          cells: ['01-01-2024', '30-06-2024', '', '1.000,00'],
        },
        {
          id: 'regulation.af-kl-canonical:beregnet:1',
          cells: ['01-07-2024', '31-12-2024', '', '1.100,00'],
        },
      ],
    });
  });
});
