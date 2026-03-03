import { describe, expect, it } from 'vitest';
import { buildEODebugIndkomstRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';

const iso = (value: string) => toISODateString(value);

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold.map((af) => ({
    ...af,
    indtaegtsoplysningerTableData: [...af.indtaegtsoplysningerTableData],
    loenudviklingManuelTableData: [...af.loenudviklingManuelTableData],
  })),
});

describe('buildEODebugIndkomstRows regulering details', () => {
  it('opretter reguleringsdetaljer for statistik og markerer manglende reguleringsværdi på reguleringsdato', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';

    const rows = buildEODebugIndkomstRows(values, iso('1900-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const reguleringsvaerdiRow = rows.find((row) => row.id === `${prefix}.reguleringsvaerdi`);
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(reguleringsvaerdiRow).toBeDefined();
    expect(startRow).toBeDefined();
    expect(slutRow).toBeDefined();
    expect(reguleringsvaerdiRow?.status).toBe('error');
    expect(reguleringsvaerdiRow?.message).toMatch(/^mangler/);
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
        dato: '01-01-2024',
        grundloen: 100,
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
    ];

    const rows = buildEODebugIndkomstRows(values, iso('2023-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(slutRow).toBeDefined();
    expect(slutRow?.status).toBe('error');
    expect(slutRow?.displayValue).toMatch(/^Nej \(kun indtil /);
    expect(slutRow?.message).toMatch(/^mangler \(kun indtil /);
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
        dato: '02-01-2024',
        grundloen: 100,
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
    ];

    const rows = buildEODebugIndkomstRows(values, iso('2024-01-01'));
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

    const rows = buildEODebugIndkomstRows(
      values,
      iso('2009-01-01'),
      {},
      {
        ...DEFAULT_APP_SETTINGS,
        allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true,
      }
    );
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

    const rows = buildEODebugIndkomstRows(values, iso('2009-01-01'));
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
        dato: '01-01-2024',
        grundloen: 100,
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
    ];

    const rows = buildEODebugIndkomstRows(values, iso('2024-01-01'));
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

    const rows = buildEODebugIndkomstRows(values, iso('2024-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(startRow).toBeUndefined();
    expect(slutRow).toBeUndefined();
  });
});
