import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
});

describe('buildEoIndkomstRows regulering details', () => {
  it('opretter reguleringsdetaljer for statistik og markerer manglende reguleringsværdi på reguleringsdato', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';

    const rows = buildEoIndkomstRows(values, iso('1900-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const reguleringsvaerdiRow = rows.find((row) => row.id === `${prefix}.reguleringsvaerdi`);
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(reguleringsvaerdiRow).toBeDefined();
    expect(startRow).toBeDefined();
    expect(slutRow).toBeDefined();
    expect(reguleringsvaerdiRow?.status).toBe('error');
    expect(reguleringsvaerdiRow?.message).toMatch(/^er ikke angivet/);
  });

  it('markerer manglende slutdækning for manuel regulering med konkret slutdato', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2025-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2025-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: toISODateString('2024-01-01'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, iso('2023-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(slutRow).toBeDefined();
    expect(slutRow?.status).toBe('error');
    expect(slutRow?.displayValue).toMatch(/^Nej \(kun indtil /);
    expect(slutRow?.message).toMatch(/^er ikke angivet \(kun indtil /);
  });

  it('behandler præcis udløbsgrænse som ikke-ok (< grænse er tilladt, = grænse er ikke)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2025-07-01');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2025-07-01'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: toISODateString('2024-01-02'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, iso('2024-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(slutRow).toBeDefined();
    expect(slutRow?.status).toBe('error');
    expect(slutRow?.displayValue).toMatch(/^Nej \(kun indtil /);
    expect(slutRow?.displayValue).not.toBe('(< 6 måneder)');
  });

  it('klassificerer manglende overenskomstdækning som warning når allow=true', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const appSettings = { ...DEFAULT_APP_SETTINGS, allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true };
    const rows = buildEoIndkomstRows(values, iso('2009-01-01'), {}, appSettings);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);

    expect(startRow).toBeDefined();
    expect(startRow?.status).toBe('warning');
    expect(startRow?.displayValue).toMatch(/^Nej \(først fra /);
  });

  it('klassificerer manglende overenskomstdækning som error når allow=false', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const rows = buildEoIndkomstRows(values, iso('2009-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);

    expect(startRow).toBeDefined();
    expect(startRow?.status).toBe('error');
  });

  it('behandler udløb under grænsen som ok med visning af månedersregel', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2025-04-30');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2025-04-30'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: toISODateString('2024-01-01'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, iso('2024-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(slutRow).toBeDefined();
    expect(slutRow?.status).toBe('ok');
    expect(slutRow?.displayValue).toBe('(< 6 måneder)');
  });

  it('opretter ikke start/slut-dækningsrows når der ikke findes TAF-boundaries', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');
    values.tafPerioder = [];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';

    const rows = buildEoIndkomstRows(values, iso('2024-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(startRow).toBeUndefined();
    expect(slutRow).toBeUndefined();
  });

  it('viser samlet ikke-blokerende dæknings-advarsel ved start-hul (allow=true)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const appSettings = { ...DEFAULT_APP_SETTINGS, allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true };
    const rows = buildEoIndkomstRows(values, iso('2009-01-01'), {}, appSettings);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeDefined();
    expect(daekningRow?.status).toBe('warning');
    expect(daekningRow?.displayValue).toMatch(/Der er ikke reguleringsværdier for hele TAF-perioden — først fra /);
    expect(daekningRow?.displayValue).not.toMatch(/kun til og med/);
  });

  it('viser IKKE samlet dæknings-advarsel når hullet er blokerende (allow=false)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const rows = buildEoIndkomstRows(values, iso('2009-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeUndefined();
  });

  it('viser samlet dæknings-advarsel ved slut-hul (KRL, allow=true)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2020-01-01');
    values.vedroererPeriodeTil = iso('2030-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2020-01-01'), til: iso('2030-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';

    const appSettings = { ...DEFAULT_APP_SETTINGS, allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true };
    const rows = buildEoIndkomstRows(values, iso('2020-01-01'), {}, appSettings);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeDefined();
    expect(daekningRow?.status).toBe('warning');
    expect(daekningRow?.displayValue).toMatch(/Der er ikke reguleringsværdier for hele TAF-perioden — kun til og med /);
    expect(daekningRow?.displayValue).not.toMatch(/først fra/);
  });

  it('viser samlet dæknings-advarsel ved hul i både start og slut (KRL regioner, allow=true)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2010-01-01');
    values.vedroererPeriodeTil = iso('2030-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2010-01-01'), til: iso('2030-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (regioner)';

    const appSettings = { ...DEFAULT_APP_SETTINGS, allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true };
    const rows = buildEoIndkomstRows(values, iso('2010-01-01'), {}, appSettings);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeDefined();
    expect(daekningRow?.status).toBe('warning');
    // KTO (regioner) starter reelt 01-10-2018 og slutter (nyeste + 6 mdr − 1 dag) længe før 2030.
    expect(daekningRow?.displayValue).toMatch(/først fra 01-10-2018 og kun til og med /);
  });
});
