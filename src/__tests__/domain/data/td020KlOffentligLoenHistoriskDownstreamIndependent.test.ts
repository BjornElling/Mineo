import { buildRegulationTimeline } from '../../../domain/eoInspektion/eoInspektionRegulationCore';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

const expectedEntries = [
  {
    effectiveFrom: '2012-01-01',
    grundloen: 15564.58,
    packageValue: 15564.58,
    index: 100,
  },
  {
    effectiveFrom: '2012-10-01',
    grundloen: 15587.08,
    packageValue: 15587.08,
    index: 100.14455899227606,
  },
] as const;

// Håndfacit fra den historiske KL-lønserie: 01-10-2012 ændrer månedslønnen fra
// 15.564,58 kr. til 15.587,08 kr. Indekset er her skrevet direkte som
// 15.587,08 / 15.564,58 × 100 = 100,14455899227606.

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.beregnesUdFra = 'Beregningsperiode';
  values.vedroererPeriodeFra = iso('2012-01-01');
  values.vedroererPeriodeTil = iso('2012-12-31');
  values.tafBeregningsperiodeTil = iso('2012-01-01');
  values.loenindkomstAnsaettelsesforhold = [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'td020-kl-offentlig-historisk',
    navnPaaArbejdssted: 'Historisk KL-facit',
    harOverenskomst: true,
    overenskomstId: 'kl-overenskomst',
    loenudviklingBeregningsgrundlag: 'Overenskomst',
    offentligLoenType: 'Månedsløn',
    offentligLoenTrin: 1,
    offentligLoenGruppe: 0,
    feriePct: 0,
    loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
  }];
  return values;
};

describe('DATA-001/CALC-006 – historisk KL-løn som EO-inspektionsforbruger', () => {
  it('fører 2012-facitter gennem den offentlige lønsti og 01-10-reguleringen', () => {
    const model = buildRegulationTimeline({
      eoValues: buildValues(),
      stamdataValues: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2012-01-01') },
      loenudvikling: null,
    });

    const ansaettelse = model.ansaettelser[0];
    expect(ansaettelse).toBeDefined();
    if (!ansaettelse) throw new Error('Forventede en historisk KL-ansaettelse');

    expect(ansaettelse.referenceIso).toBe(iso('2012-01-01'));
    expect(ansaettelse.referenceValue).toBe(15564.58);
    expect(ansaettelse.entries.map(({ effectiveFrom, grundloen, packageValue, index }) => ({
      effectiveFrom,
      grundloen,
      packageValue,
      index,
    }))).toEqual(expectedEntries.map((entry) => ({
      ...entry,
      effectiveFrom: iso(entry.effectiveFrom),
    })));
  });
});
