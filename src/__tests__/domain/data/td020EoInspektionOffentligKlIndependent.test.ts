import { buildRegulationTimeline } from '../../../domain/eoInspektion/eoInspektionRegulationCore';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.beregnesUdFra = 'Beregningsperiode';
  values.vedroererPeriodeFra = iso('2024-04-02');
  values.vedroererPeriodeTil = iso('2024-04-02');
  values.tafBeregningsperiodeTil = iso('2024-04-02');
  values.loenindkomstAnsaettelsesforhold = [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'td020-eo-inspektion-kl',
    navnPaaArbejdssted: 'KL-facit',
    harOverenskomst: true,
    overenskomstId: 'kl-overenskomst',
    feriePct: 12.5,
    loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    // Facitet er regnet MED Store Bededagstillægget, som nu kræver et eksplicit tilvalg
    // (indskudte-loentillaeg-contract.md §2a).
    beregnStoreBededagstillaeg: true,
    loenudviklingBeregningsgrundlag: 'Overenskomst',
    offentligLoenType: 'Timeløn',
    offentligLoenTrin: 20,
    offentligLoenGruppe: 0,
  }];
  return values;
};

describe('DATA-001/TD-020 – KL-løn som EO-inspektion-consumer', () => {
  it('fører KL-løn og helligdagsregel gennem reguleringstidslinjen', () => {
    const referenceDate = iso('2024-04-02');
    const result = buildRegulationTimeline({
      eoValues: buildValues(),
      stamdataValues: { ...STAMDATA_INITIAL_VALUES, skadedato: referenceDate },
      loenudvikling: null,
    });

    const employment = result.ansaettelser[0];
    const entry = employment?.entries[0];

    expect(employment).toBeDefined();
    expect(entry).toBeDefined();
    if (!employment || !entry) return;

    // Håndfacit fra KL-tabellen pr. 01-04-2024, trin 20, gruppe 0:
    // 164,51 kr./time × (1 + 12,5 % feriepenge + 0,45 % Store Bededag)
    // = 185,814045 kr. Der er ingen KL-tillægssats i den separate tillægstabel.
    expect(employment.referenceIso).toBe(referenceDate);
    expect(employment.referenceValue).toBeCloseTo(185.814045, 10);
    expect(employment.entries).toHaveLength(1);
    expect(entry).toMatchObject({
      effectiveFrom: referenceDate,
      grundloen: 164.51,
      feriePct: 0.125,
      shSoPct: 0,
      fritvalgPct: 0,
      pensionPct: 0,
      index: 100,
    });
    expect(entry.storeBededagPct).toBeCloseTo(0.0045, 10);
    expect(entry.packageValue).toBeCloseTo(185.814045, 10);
  });
});
