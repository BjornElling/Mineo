import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
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
    const eoValues = buildValues();
    const stamdataValues = { ...STAMDATA_INITIAL_VALUES, skadedato: eoValues.tafBeregningsperiodeTil };
    // Angivet løn giver et komplet løngrundlag uden en irrelevant indkomsttabel i denne dataprobe.
    eoValues.beregnesUdFra = 'Angivet månedsløn';
    eoValues.maanedsloenenUdgoer = { kind: 'number', value: 30000 };
    eoValues.angivetMaanedsloenOpreguleresFraDato = eoValues.tafBeregningsperiodeTil;
    eoValues.eoAngivetLoenLoenudvikling = { ...eoValues.eoAngivetLoenLoenudvikling, ...eoValues.loenindkomstAnsaettelsesforhold[0] };
    const loenudvikling = buildLoenudviklingModel(eoValues, stamdataValues, 'Måneder', null, {
      tafRanges: [{ fra: eoValues.vedroererPeriodeFra!, til: eoValues.vedroererPeriodeTil! }],
    });
    const result = buildRegulationTimeline({ eoValues, stamdataValues, loenudvikling });

    const employment = result.ansaettelser[0];
    const entry = employment?.entries[0];

    expect(employment).toBeDefined();
    expect(entry).toBeDefined();
    if (!employment || !entry) return;

    // Håndfacit fra KL-tabellen pr. 01-04-2024, trin 20, gruppe 0:
    // 164,51 kr./time × (1 + 12,5 % feriepenge + 0,45 % Store Bededag)
    // = 185,814045 kr. Der er ingen KL-tillægssats i den separate tillægstabel.
    expect(employment.referenceIso).toBe(iso('2024-04-02'));
    expect(employment.referenceValue).toBeCloseTo(185.814045, 10);
    expect(employment.entries).toHaveLength(1);
    expect(entry).toMatchObject({
      effectiveFrom: iso('2024-04-02'),
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
