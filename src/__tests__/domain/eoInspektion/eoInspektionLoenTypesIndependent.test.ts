/**
 * Uafhængige facitter for kontroltabel-id'ernes parser og kolonneklassifikation.
 */

import {
  kontrolTabelColumnId,
  isAmountColumnId,
  parseEmploymentIndexFromColumnId,
} from '../../../domain/eoInspektion/eoInspektionLoenTypes';

describe('eoInspektionLoenTypes – kontroltabel-id’er', () => {
  it('producerer de kanoniske id-formater for TAF, løn og offentlige ydelser', () => {
    expect(kontrolTabelColumnId.taf).toBe('base:taf_day');
    expect(kontrolTabelColumnId.tafRegulering(0)).toBe('loen:0:taf_regulering');
    expect(kontrolTabelColumnId.tafRegulering(12)).toBe('loen:12:taf_regulering');
    expect(kontrolTabelColumnId.loenWage(2, 'grundloen')).toBe('loen:2:wage:grundloen');
    expect(kontrolTabelColumnId.loenWage(7, 'samlet')).toBe('loen:7:wage:samlet');
    expect(kontrolTabelColumnId.offentlig('sygedagpenge')).toBe('offentlig:sygedagpenge');
    expect(kontrolTabelColumnId.offentlig('ledighedsydelse')).toBe('offentlig:ledighedsydelse');
  });

  it('klassificerer offentlige ydelser og løn-wage-id’er som beløbskolonner', () => {
    const amountColumnIds = [
      'offentlig:sygedagpenge',
      'offentlig:ledighedsydelse',
      'loen:0:wage:grundloen',
      'loen:4:wage:samlet',
    ];

    for (const columnId of amountColumnIds) {
      expect(isAmountColumnId(columnId)).toBe(true);
    }
  });

  it('afviser TAF- og øvrige ikke-beløbs-id’er som beløbskolonner', () => {
    const nonAmountColumnIds = ['base:taf_day', 'loen:0:taf_regulering', 'offentlig', 'loen:0:wage'];

    for (const columnId of nonAmountColumnIds) {
      expect(isAmountColumnId(columnId)).toBe(false);
    }
  });

  it('udleder ansættelsesindekset fra gyldige TAF-regulerings- og wage-id’er', () => {
    const validIds = [
      ['loen:0:taf_regulering', 0],
      ['loen:12:taf_regulering', 12],
      ['loen:0:wage:grundloen', 0],
      ['loen:3:wage:ikkePensionsgivende', 3],
      ['loen:27:wage:samlet', 27],
    ] as const;

    for (const [columnId, expectedIndex] of validIds) {
      expect(parseEmploymentIndexFromColumnId(columnId)).toBe(expectedIndex);
    }
  });

  it('returnerer null for offentlige id’er og ugyldige kolonne-id-formater', () => {
    const invalidIds = [
      'base:taf_day',
      'offentlig:sygedagpenge',
      'loen:taf_regulering',
      'loen:x:taf_regulering',
      'loen:-1:taf_regulering',
      'loen:1.5:taf_regulering',
      'loen:1:wage:',
      'loen:1:wage:grundloen:ekstra',
      'loen:1:anden',
      '',
    ];

    for (const columnId of invalidIds) {
      expect(parseEmploymentIndexFromColumnId(columnId)).toBeNull();
    }
  });
});
