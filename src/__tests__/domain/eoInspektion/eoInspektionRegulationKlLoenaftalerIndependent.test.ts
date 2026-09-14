import { buildRegulationInspektionSections } from '../../../domain/eoInspektion/eoInspektionRegulationViewModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
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
    id: 'af-kl-viewmodel',
    navnPaaArbejdssted: 'KL-sted',
    loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
  }];
  return values;
};

const buildTimeline = (): RegulationIndexTimeline => ({
  tafBeregningsenhed: 'Måneder',
  ansaettelser: [{
    ansaettelsesforholdId: 'af-kl-viewmodel',
    navn: 'KL-sted',
    kildeLabel: 'KL-lønaftaler',
    kildeVaerdi: 'KL-lønaftaler',
    referenceIso: iso('2024-01-01'),
    referenceLabel: 'Skadedato',
    referenceValue: 1,
    entries: [
      {
        effectiveFrom: iso('2024-01-01'),
        grundloen: 0.125,
        feriePct: 0,
        shSoPct: 0,
        fritvalgPct: 0,
        storeBededagPct: 0,
        pensionPct: 0,
        packageValue: 0.125,
        index: 100,
        arbejdsdage: null,
        maaneder: 1,
      },
      {
        effectiveFrom: iso('2024-07-01'),
        grundloen: 0.1375,
        feriePct: 0,
        shSoPct: 0,
        fritvalgPct: 0,
        storeBededagPct: 0,
        pensionPct: 0,
        packageValue: 0.1375,
        index: 100,
        arbejdsdage: null,
        maaneder: 6,
      },
    ],
  }],
});

describe('CALC-006 – uafhængigt facit for KL-lønaftalers EO-viewmodel', () => {
  it('viser rå KL-lønaftaleentries i den særskilte reguleringstabel uden canonical segmenter', () => {
    const sections = buildRegulationInspektionSections({
      timeline: buildTimeline(),
      canonicalOutput: undefined,
      eoValues: buildValues(),
      stamdataValues: {
        ...STAMDATA_INITIAL_VALUES,
        skadedato: iso('2024-01-01'),
      },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.header).toBe('Regulering (KL-sted)');
    expect(sections[0]?.tables).toHaveLength(1);
    expect(sections[0]?.tables?.[0]).toEqual({
      id: 'regulation.af-kl-viewmodel:vaerdier',
      columns: ['Dato', 'Regulering'],
      rows: [
        {
          id: 'regulation.table:af-kl-viewmodel:2024-01-01',
          cells: [
            { rawValue: iso('2024-01-01'), displayValue: '01-01-2024' },
            '12,50%',
          ],
        },
        {
          id: 'regulation.table:af-kl-viewmodel:2024-07-01',
          cells: [
            { rawValue: iso('2024-07-01'), displayValue: '01-07-2024' },
            '13,75%',
          ],
        },
      ],
    });
  });
});
