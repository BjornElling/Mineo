import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeTafBeregningsenhed, TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR, TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return { ...base, ...patch };
};

describe('computeTafBeregningsenhed', () => {
  it('defaults to months', () => {
    const values = makeValues({});
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('returns workdays when "Beregnes ud fra" is "Angivet dagsløn"', () => {
    const values = makeValues({ beregnesUdFra: 'Angivet dagsløn' });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
  });

  it('returns months when "Beregnes ud fra" is "Angivet månedsløn"', () => {
    const values = makeValues({ beregnesUdFra: 'Angivet månedsløn' });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('does not switch to workdays when "Øvrigt fravær uden løn" has a non-zero day count', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      oevrigtFravaerUdenLoen: 'Ja',
      oevrigeFravaersdage: 1,
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('does not switch to workdays when "Øvrigt fravær uden løn" is enabled but day count is 0', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      oevrigtFravaerUdenLoen: 'Ja',
      oevrigeFravaersdage: 0,
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('stays months for "Angivet månedsløn" even with non-standard holiday pay on employment', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenPaaHelligdage: 'SH-udbetaling',
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('stays workdays for "Angivet dagsløn" even with full-pay vacation settings', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          fuldLoenUnderFerie: 'Ja',
          loenPaaHelligdage: 'Almindelig løn',
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
  });

  it('is forced to workdays in "Beregningsperiode" when holiday pay deviates', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenPaaHelligdage: 'SH-udbetaling',
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '1',
              col1_maaned: '2024',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: { kind: 'number', value: 1000 },
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
  });

  it('stays months in "Beregningsperiode" with standard holiday/vacation settings', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenPaaHelligdage: 'Almindelig løn',
          fuldLoenUnderFerie: 'Ja',
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('stays months when non-standard settings exist but no overlapping income row in beregningsperiode', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenPaaHelligdage: 'SH-udbetaling',
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '1',
              col1_maaned: '2023',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: { kind: 'number', value: 1000 },
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('stays months when overlap exists but no indtastet løn in overlap row', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenPaaHelligdage: 'SH-udbetaling',
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '1',
              col1_maaned: '2024',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: undefined,
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('fraDate > tilDate → beregningsperiode ignoreres → MAANEDER', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      // tafBeregningsperiodeFra er EFTER tafBeregningsperiodeTil
      tafBeregningsperiodeFra: toISODateString('2024-12-31'),
      tafBeregningsperiodeTil: toISODateString('2024-01-01'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenPaaHelligdage: 'SH-udbetaling',
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '6',
              col1_maaned: '2024',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: { kind: 'number', value: 1000 },
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    // fraDate > tilDate → betingelsen (fraDate <= tilDate) er falsk → MAANEDER
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('tom loenindkomstAnsaettelsesforhold → MAANEDER (ingen ansættelsesforhold at oversty re fra)', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('beregningsperiode på én dag (fra === til) med afvigende helligdage og overlap → ARBEJDSDAGE', () => {
    // Grænsetilfælde: enkeltdags-beregningsperiode
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2024-06-17'),
      tafBeregningsperiodeTil: toISODateString('2024-06-17'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenPaaHelligdage: 'SH-udbetaling',
          // Lønindkomst-rækken overlapper præcis enkeltdags-perioden (juni 2024)
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '6',
              col1_maaned: '2024',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: { kind: 'number', value: 2000 },
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
  });
});

describe('TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR', () => {
  it('is 4.8% of a month per workday', () => {
    expect(TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR).toBe(0.048);
  });
});
