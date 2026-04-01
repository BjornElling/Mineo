
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  buildSammentaellingDisplayTables,
  getSammentaellingControlStatus,
  type SammentaellingControl,
  type SammentaellingModel,
} from '../../../domain/debug/eoDebugSammentaelling';

const baseControl: SammentaellingControl = {
  beregnetDisplay: '-',
  tabelDisplay: '-',
  beregnetValue: null,
  tabelValue: null,
  loseFeriedage: 0,
  oevrigeFravaersdage: 0,
};

describe('getSammentaellingControlStatus', () => {
  it('returns ok when both values are null', () => {
    const control: SammentaellingControl = {
      ...baseControl,
      beregnetDisplay: '-',
      tabelDisplay: '0',
      beregnetValue: null,
      tabelValue: null,
    };
    expect(getSammentaellingControlStatus(control)).toBe('ok');
  });

  it('returns ok when numeric values match', () => {
    const control: SammentaellingControl = {
      ...baseControl,
      beregnetDisplay: '100,00',
      tabelDisplay: '100',
      beregnetValue: 100,
      tabelValue: 100,
    };
    expect(getSammentaellingControlStatus(control)).toBe('ok');
  });

  it('returns ok when values are 0/null but display as "-"', () => {
    const control: SammentaellingControl = {
      ...baseControl,
      beregnetDisplay: '-',
      tabelDisplay: '-',
      beregnetValue: null,
      tabelValue: 0,
    };
    expect(getSammentaellingControlStatus(control)).toBe('ok');
  });

  it('returns ok when values are within rounding tolerance', () => {
    const control: SammentaellingControl = {
      ...baseControl,
      beregnetDisplay: '29.600,00',
      tabelDisplay: '29.600,00',
      beregnetValue: 29600,
      tabelValue: 29600.0000001,
    };
    expect(getSammentaellingControlStatus(control)).toBe('ok');
  });

  it('returns error when values differ', () => {
    const control: SammentaellingControl = {
      ...baseControl,
      beregnetDisplay: '8',
      tabelDisplay: '10',
      beregnetValue: 8,
      tabelValue: 10,
    };
    expect(getSammentaellingControlStatus(control)).toBe('error');
  });
});

describe('buildSammentaellingDisplayTables', () => {
  const makeModel = (overrides: Partial<SammentaellingModel> = {}): SammentaellingModel => ({
    beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    beregningsperiode: {
      ...baseControl,
      ferieDageCount: 5,
      shDageCount: 3,
    },
    taf: {
      ...baseControl,
      ferieDageCount: 2,
      shDageCount: 1,
    },
    svieSmerteSygedage: baseControl,
    svieSmerteDelvise: baseControl,
    beregningsperiodeIndtaegter: [],
    tafIndtaegter: [],
    ...overrides,
  });

  it('viser udspecificeret feriedage og SH-dage for beregningsperiode', () => {
    const tables = buildSammentaellingDisplayTables(makeModel());
    expect(tables.basis[0]?.label).toBe('Arbejdsdage i beregningsperiode (inkl. 5 feriedage og 3 SH-dage)');
  });

  it('viser udspecificeret feriedage og SH-dage for TAF-periode', () => {
    const tables = buildSammentaellingDisplayTables(makeModel());
    expect(tables.basis[1]?.label).toBe('Arbejdsdage i TAF-periode (inkl. 2 feriedage og 1 SH-dage)');
  });

  it('viser minus-prefix når TAF beregnes som arbejdsdage', () => {
    const tables = buildSammentaellingDisplayTables(makeModel({ beregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE }));
    expect(tables.basis[0]?.label).toBe('Arbejdsdage i beregningsperiode (- 5 feriedage og 3 SH-dage)');
    expect(tables.basis[1]?.label).toBe('Arbejdsdage i TAF-periode (- 2 feriedage og 1 SH-dage)');
  });

  it('viser ekstra parentes med løse feriedage/øvrigt fravær når de findes', () => {
    const tables = buildSammentaellingDisplayTables(makeModel({
      beregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      beregningsperiode: {
        ...baseControl,
        ferieDageCount: 8,
        dateredeFerieDageCount: 8,
        loseFerieDageCount: 30,
        shDageCount: 8,
        oevrigeFravaersdage: 11,
      },
      taf: {
        ...baseControl,
        ferieDageCount: 22,
        dateredeFerieDageCount: 22,
        loseFerieDageCount: 5,
        shDageCount: 3,
      },
    }));

    expect(tables.basis[0]?.label).toBe(
      'Arbejdsdage i beregningsperiode (- 8 feriedage og 8 SH-dage) (- 41 løse ferie- og fraværsdage)'
    );
    expect(tables.basis[1]?.label).toBe(
      'Arbejdsdage i TAF-periode (- 22 feriedage og 3 SH-dage) (- 5 løse feriedage)'
    );
  });
});
