import { describe, expect, it } from 'vitest';

import { getSammentaellingControlStatus, type SammentaellingControl } from '../../../domain/debug/eoDebugSammentaelling';

const baseControl: SammentaellingControl = {
  beregnetDisplay: '-',
  tabelDisplay: '-',
  beregnetValue: null,
  tabelValue: null,
  loseFeriedage: 0,
  oevrigeFravaersdage: 0,
  warningEligible: false,
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

  it('returns warning when warning-eligible match holds', () => {
    const control: SammentaellingControl = {
      ...baseControl,
      beregnetDisplay: '8',
      tabelDisplay: '10',
      beregnetValue: 8,
      tabelValue: 10,
      loseFeriedage: 1,
      oevrigeFravaersdage: 1,
      warningEligible: true,
    };
    expect(getSammentaellingControlStatus(control)).toBe('warning');
  });

  it('returns error otherwise', () => {
    const control: SammentaellingControl = {
      ...baseControl,
      beregnetDisplay: '8',
      tabelDisplay: '10',
      beregnetValue: 8,
      tabelValue: 10,
      warningEligible: false,
    };
    expect(getSammentaellingControlStatus(control)).toBe('error');
  });
});
